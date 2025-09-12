import { useState, useEffect } from 'react'
import { Search, MapPin, Clock, Phone, Globe, Layers, Filter, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SmartMap } from '@/components/SmartMap'
import './App.css'

interface Category {
  key: string
  label: string
}

interface Place {
  id: number
  name: string
  lat: number
  lon: number
  address: string
  tags: Record<string, string>
}

interface SearchResult {
  town: string
  category: string
  places: Place[]
  count: number
}

function App() {
  const [town, setTown] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [mapView, setMapView] = useState<'standard' | 'satellite' | 'terrain'>('standard')

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`)
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data = await response.json()
      setCategories(data.categories)
      if (data.categories.length > 0) {
        setCategory(data.categories[0].key)
      }
    } catch (err) {
      setError('Failed to load categories')
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!town.trim() || !category) return

    setLoading(true)
    setError('')
    setResults(null)

    try {
      const response = await fetch(
        `${API_URL}/api/places?town=${encodeURIComponent(town)}&category=${encodeURIComponent(category)}`
      )
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to fetch places')
      }
      
      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (place: Place) => {
    if (place.address) return place.address
    return `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`
  }

  const getPlaceDetails = (place: Place) => {
    const details = []
    if (place.tags.phone) details.push({ icon: Phone, text: place.tags.phone })
    if (place.tags.website) details.push({ icon: Globe, text: place.tags.website })
    if (place.tags.opening_hours) details.push({ icon: Clock, text: place.tags.opening_hours })
    return details
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-6xl font-serif text-amber-900 mb-4 tracking-wide">
            Explore My Town
          </h1>
          <p className="text-xl text-amber-700 font-serif italic">
            Discover the hidden gems and essential services in any town
          </p>
          <div className="w-32 h-1 bg-amber-600 mx-auto mt-6"></div>
        </header>

        <Card className="max-w-2xl mx-auto mb-8 shadow-lg border-amber-200 bg-white/90">
          <CardHeader className="bg-amber-100 border-b border-amber-200">
            <CardTitle className="text-2xl font-serif text-amber-900 flex items-center gap-2">
              <Search className="w-6 h-6" />
              Search for Places
            </CardTitle>
            <CardDescription className="text-amber-700 font-serif">
              Enter a town name and select what you're looking for
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-serif font-medium text-amber-900 mb-2">
                  Town Name
                </label>
                <Input
                  type="text"
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                  placeholder="Enter town name (e.g., Paris, London, New York)"
                  className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-serif font-medium text-amber-900 mb-2">
                  Category
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="border-amber-300 focus:border-amber-500 focus:ring-amber-500">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                type="submit" 
                disabled={loading || !town.trim() || !category}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white font-serif text-lg py-3"
              >
                {loading ? 'Searching...' : 'Search Places'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Card className="max-w-2xl mx-auto mb-8 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-700 font-serif text-center">{error}</p>
            </CardContent>
          </Card>
        )}

        {results && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-serif text-amber-900">
                {results.count} {categories.find(c => c.key === results.category)?.label} in {results.town}
              </h2>
              <Button
                onClick={() => setShowMap(!showMap)}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 font-serif"
              >
                {showMap ? 'Hide Map' : 'Show Map'}
              </Button>
            </div>

            {showMap && (
              <Card className="mb-8 border-amber-200">
                <CardHeader className="bg-amber-100 border-b border-amber-200 pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-serif text-amber-900 flex items-center gap-2">
                      <Navigation className="w-5 h-5" />
                      Smart Map View
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMapView('standard')}
                        className={`font-serif text-xs ${mapView === 'standard' ? 'bg-amber-200 border-amber-400' : 'border-amber-300 text-amber-700'}`}
                      >
                        <Layers className="w-3 h-3 mr-1" />
                        Standard
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-300 text-amber-700 font-serif text-xs"
                      >
                        <Filter className="w-3 h-3 mr-1" />
                        Filter
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-amber-700 font-serif">
                    Showing {results.count} {categories.find(c => c.key === results.category)?.label.toLowerCase()} in {results.town}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <SmartMap 
                    places={results.places} 
                    category={results.category}
                  />
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.places.map((place) => (
                <Card key={place.id} className="border-amber-200 bg-white/90 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-serif text-amber-900 flex items-start gap-2">
                      <MapPin className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0" />
                      <span className="line-clamp-2">{place.name}</span>
                    </CardTitle>
                    <CardDescription className="text-amber-700 font-serif">
                      {formatAddress(place)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {getPlaceDetails(place).map((detail, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-amber-700">
                          <detail.icon className="w-4 h-4 text-amber-600" />
                          <span className="font-serif">{detail.text}</span>
                        </div>
                      ))}
                      
                      {Object.keys(place.tags).length > 0 && (
                        <>
                          <Separator className="bg-amber-200" />
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(place.tags)
                              .filter(([key]) => !['name', 'phone', 'website', 'opening_hours', 'addr:full', 'addr:street', 'addr:city', 'addr:housenumber'].includes(key))
                              .slice(0, 3)
                              .map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs bg-amber-100 text-amber-800 font-serif">
                                  {key}: {value}
                                </Badge>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {results.places.length === 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-8 text-center">
                  <p className="text-amber-700 font-serif text-lg">
                    No {categories.find(c => c.key === results.category)?.label.toLowerCase()} found in {results.town}.
                  </p>
                  <p className="text-amber-600 font-serif text-sm mt-2">
                    Try searching for a different category or check the town name spelling.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <footer className="text-center mt-16 pt-8 border-t border-amber-200">
          <p className="text-amber-600 font-serif text-sm">
            Powered by OpenStreetMap • Classic design for timeless exploration
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
