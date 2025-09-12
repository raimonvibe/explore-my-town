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
    category: str = Query(..., description="Category of places to find")
):
    """Get places in a town by category"""
    if not town or not category:
        raise HTTPException(status_code=400, detail="Missing town or category parameter")
    
    if category not in CATEGORY_TAGS:
        raise HTTPException(status_code=400, detail=f"Invalid category. Available: {list(CATEGORY_TAGS.keys())}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            geo_response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": town,
                    "format": "json",
                    "limit": 1
                },
                headers={"User-Agent": "ExploreTownApp/1.0"}
            )
            
            if geo_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to geocode town")
            
            geo_data = geo_response.json()
            if not geo_data:
                raise HTTPException(status_code=404, detail="Town not found")
            
            lat, lon = geo_data[0]["lat"], geo_data[0]["lon"]
            
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
            
            return {
                "town": town,
                "category": category,
                "places": places,
                "count": len(places)
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
