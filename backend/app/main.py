from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
from typing import List, Dict, Any

app = FastAPI(title="Explore My Town API", description="API for finding places in towns")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

CATEGORY_TAGS = {
    "cafe": "amenity=cafe",
    "restaurant": "amenity=restaurant", 
    "bar": "amenity=bar",
    "barber": "shop=hairdresser",
    "coffeeshop": "amenity=cafe",
    "cinema": "amenity=cinema",
    "toilet": "amenity=toilets",
    "bakery": "shop=bakery",
    "pharmacy": "amenity=pharmacy",
    "park": "leisure=park"
}

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/api/categories")
async def get_categories():
    """Get all available categories"""
    categories = [
        {"key": "cafe", "label": "Cafés"},
        {"key": "restaurant", "label": "Restaurants"},
        {"key": "bar", "label": "Bars & Pubs"},
        {"key": "barber", "label": "Barbers & Hairdressers"},
        {"key": "coffeeshop", "label": "Coffee Shops"},
        {"key": "cinema", "label": "Cinemas & Theatres"},
        {"key": "toilet", "label": "Public Toilets"},
        {"key": "bakery", "label": "Bakeries"},
        {"key": "pharmacy", "label": "Pharmacies"},
        {"key": "park", "label": "Parks & Gardens"}
    ]
    return {"categories": categories}

@app.get("/api/places")
async def get_places(
    town: str = Query(..., description="Town name to search in"),
    category: str = Query(..., description="Category of places to find"),
    page: int = Query(1, ge=1, description="Page number (starts from 1)"),
    limit: int = Query(20, ge=1, le=100, description="Number of places per page (max 100)")
):
    """Get places in a town by category"""
    if not town or not category:
        raise HTTPException(status_code=400, detail="Missing town or category parameter")
    
    if category not in CATEGORY_TAGS:
        raise HTTPException(status_code=400, detail=f"Invalid category. Available: {list(CATEGORY_TAGS.keys())}")
    
    # Enhanced town name validation
    town_clean = town.strip()
    if len(town_clean) < 3:
        raise HTTPException(status_code=400, detail="Town name must be at least 3 characters long")
    
    # Check for repeated characters (like "Ppppp", "Aaaaa", etc.)
    import re
    if re.search(r'(.)\1{2,}', town_clean):
        raise HTTPException(status_code=400, detail="Invalid town name: repeated characters not allowed")
    
    # Check for obviously invalid patterns
    if re.match(r'^[A-Za-z]{1,2}$', town_clean.replace(' ', '')):
        raise HTTPException(status_code=400, detail="Please enter a full town or city name")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            geo_response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": town_clean,
                    "format": "json",
                    "limit": 5,  # Get more results to validate
                    "addressdetails": 1,
                    "extratags": 1
                },
                headers={"User-Agent": "ExploreTownApp/1.0"}
            )
            
            if geo_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to geocode town")
            
            geo_data = geo_response.json()
            if not geo_data:
                raise HTTPException(status_code=404, detail="Town not found")
            
            # Validate the geocoding results
            best_match = None
            for result in geo_data:
                # Check if this looks like a real place
                display_name = result.get("display_name", "").lower()
                place_type = result.get("type", "").lower()
                importance = result.get("importance", 0)
                
                # Look for city, town, village, municipality, etc.
                if any(place_type in ["city", "town", "village", "municipality", "hamlet", "suburb"] for place_type in [place_type]):
                    if importance > 0.1:  # Minimum importance threshold
                        best_match = result
                        break
                elif "city" in display_name or "town" in display_name or "village" in display_name:
                    if importance > 0.05:  # Lower threshold for named places
                        best_match = result
                        break
            
            if not best_match:
                # If no good match found, check if any result has reasonable importance
                for result in geo_data:
                    if result.get("importance", 0) > 0.3:  # High importance threshold
                        best_match = result
                        break
                
                if not best_match:
                    raise HTTPException(status_code=404, detail="No valid town found. Please check the spelling and try again.")
            
            lat, lon = best_match["lat"], best_match["lon"]
            
            tag = CATEGORY_TAGS[category]
            overpass_query = f"""
            [out:json][timeout:25];
            (
                node[{tag}](around:5000,{lat},{lon});
                way[{tag}](around:5000,{lat},{lon});
                relation[{tag}](around:5000,{lat},{lon});
            );
            out center;
            """
            
            overpass_response = await client.post(
                "https://overpass-api.de/api/interpreter",
                content=overpass_query,
                headers={
                    "Content-Type": "text/plain",
                    "User-Agent": "ExploreTownApp/1.0"
                }
            )
            
            if overpass_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch places data")
            
            overpass_data = overpass_response.json()
            
            places = []
            for element in overpass_data.get("elements", []):
                place = {
                    "id": element.get("id"),
                    "name": element.get("tags", {}).get("name", "Unnamed"),
                    "lat": element.get("lat") or (element.get("center", {}).get("lat")),
                    "lon": element.get("lon") or (element.get("center", {}).get("lon")),
                    "address": _format_address(element.get("tags", {})),
                    "tags": element.get("tags", {})
                }
                
                if place["lat"] and place["lon"]:
                    places.append(place)
            
            # Calculate pagination
            total_count = len(places)
            start_index = (page - 1) * limit
            end_index = start_index + limit
            paginated_places = places[start_index:end_index]
            
            # Calculate pagination metadata
            total_pages = (total_count + limit - 1) // limit
            has_next = page < total_pages
            has_prev = page > 1
            
            return {
                "town": town_clean,
                "found_location": best_match.get("display_name", town_clean),
                "category": category,
                "places": paginated_places,
                "count": len(paginated_places),
                "total_count": total_count,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total_pages": total_pages,
                    "has_next": has_next,
                    "has_prev": has_prev
                }
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timeout - please try again")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

def _format_address(tags: Dict[str, Any]) -> str:
    """Format address from OSM tags"""
    address_parts = []
    
    if "addr:full" in tags:
        return tags["addr:full"]
    
    if "addr:housenumber" in tags:
        address_parts.append(tags["addr:housenumber"])
    if "addr:street" in tags:
        address_parts.append(tags["addr:street"])
    if "addr:city" in tags:
        address_parts.append(tags["addr:city"])
    
    return ", ".join(address_parts) if address_parts else ""
