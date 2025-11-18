
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InvokeLLM } from '@/integrations/Core';
import { Search, MapPin, Loader2, Clock, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MapSearchAutocomplete({ 
  onLocationSelect, 
  isGeocoding, 
  onSearchStart,
  onGeocodeFail, // Added new prop
  placeholder = "Search addresses, businesses, coordinates..."
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState([]);
  
  const inputRef = useRef(null);
  const suggestionRefs = useRef([]);
  const debounceTimer = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // Load recent searches from localStorage
    const stored = localStorage.getItem('map_search_recent');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading recent searches:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Click outside handler
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveRecentSearch = (searchItem) => {
    const updated = [searchItem, ...recentSearches.filter(item => item.query !== searchItem.query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('map_search_recent', JSON.stringify(updated));
  };

  const getSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    
    try {
      const suggestions = await InvokeLLM({
        prompt: `Generate 5 relevant location suggestions for the search query: "${query}". 
        Include a mix of:
        - Specific addresses if the query looks like an address
        - Popular businesses/landmarks that match the query
        - Neighborhoods or areas that match
        - Cities/towns that match
        
        For each suggestion, provide:
        - A display name (what the user will see)
        - A search query (what will be used for geocoding)
        - A type (address, business, landmark, neighborhood, or city)
        
        Respond with a JSON array of objects with keys: display_name, search_query, type
        
        Example for "starbucks manhattan":
        [
          {"display_name": "Starbucks Times Square, Manhattan", "search_query": "Starbucks Times Square New York NY", "type": "business"},
          {"display_name": "Starbucks Union Square, Manhattan", "search_query": "Starbucks Union Square New York NY", "type": "business"}
        ]`,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  display_name: { type: "string" },
                  search_query: { type: "string" },
                  type: { type: "string" }
                },
                required: ["display_name", "search_query", "type"]
              }
            }
          }
        }
      });

      if (suggestions && suggestions.suggestions && Array.isArray(suggestions.suggestions)) {
        setSuggestions(suggestions.suggestions);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error getting suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSelectedIndex(-1);
    
    // Clear existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(value.length === 0 && recentSearches.length > 0);
      return;
    }

    // Debounce API calls - wait 300ms after user stops typing
    debounceTimer.current = setTimeout(() => {
      getSuggestions(value);
    }, 300);

    setShowSuggestions(true);
  };

  const handleInputFocus = () => {
    if (searchTerm.length === 0 && recentSearches.length > 0) {
      setShowSuggestions(true);
    } else if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    const totalItems = (searchTerm.length === 0 && recentSearches.length > 0 ? recentSearches.length : 0) + suggestions.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < totalItems - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : totalItems - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (searchTerm.length === 0 && recentSearches.length > 0) {
            // Select from recent searches
            handleSelectSuggestion(recentSearches[selectedIndex]);
          } else if (suggestions.length > 0) {
            // Select from current suggestions
            const actualIndex = searchTerm.length === 0 ? selectedIndex - recentSearches.length : selectedIndex;
            handleSelectSuggestion(suggestions[actualIndex]);
          }
        } else if (searchTerm.trim()) {
          // Direct search
          handleDirectSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectSuggestion = async (suggestion) => {
    const searchQuery = suggestion.search_query || suggestion.query;
    setSearchTerm(suggestion.display_name || searchQuery);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    onSearchStart();
    
    try {
      const result = await geocodeLocation(searchQuery);
      if (result) {
        saveRecentSearch({
          query: searchQuery,
          display_name: suggestion.display_name || searchQuery,
          type: suggestion.type || 'search'
        });
        onLocationSelect(result);
      } else {
        throw new Error('No location found for suggestion'); // Added error for no result
      }
    } catch (error) {
      console.error('Error selecting suggestion:', error);
      if (onGeocodeFail) onGeocodeFail(); // Call onGeocodeFail on error
    }
  };

  const handleDirectSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setShowSuggestions(false);
    onSearchStart();
    
    try {
      const result = await geocodeLocation(searchTerm);
      if (result) {
        saveRecentSearch({
          query: searchTerm,
          display_name: searchTerm,
          type: 'search'
        });
        onLocationSelect(result);
      } else {
        throw new Error('No location found');
      }
    } catch (error) {
      console.error('Error with direct search:', error);
      if (onGeocodeFail) onGeocodeFail();
    }
  };

  const geocodeLocation = async (query) => {
    try {
      const geocodeResult = await InvokeLLM({
        prompt: `Find the exact latitude and longitude coordinates for this location: "${query}". 
        This could be an address, business name, landmark, neighborhood, or city.
        
        Please provide precise coordinates that will center a map on this location.
        
        Respond ONLY with a valid JSON object containing "lat" and "lng" as numbers.
        
        Example response format:
        {"lat": 40.7589, "lng": -73.9851}
        
        If you cannot find the location, respond with:
        {"lat": null, "lng": null}`,
        response_json_schema: {
          type: "object",
          properties: {
            lat: { type: ["number", "null"] },
            lng: { type: ["number", "null"] }
          },
          required: ["lat", "lng"]
        }
      });

      console.log('Geocode result:', geocodeResult);

      if (geocodeResult && 
          geocodeResult.lat !== null && 
          geocodeResult.lng !== null &&
          typeof geocodeResult.lat === 'number' && 
          typeof geocodeResult.lng === 'number') {
        
        // Validate coordinates are within valid ranges
        if (geocodeResult.lat >= -90 && geocodeResult.lat <= 90 && 
            geocodeResult.lng >= -180 && geocodeResult.lng <= 180) {
          return [geocodeResult.lat, geocodeResult.lng];
        }
      }
      
      throw new Error("Invalid coordinates received");
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'business': return Building;
      case 'address': return MapPin;
      case 'landmark': return MapPin;
      default: return Search;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'business': return 'text-blue-600';
      case 'address': return 'text-green-600';
      case 'landmark': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          className="pl-10 pr-20 text-sm sm:text-base truncate"
          disabled={isGeocoding}
          style={{ minHeight: '44px' }}
        />
        <Button
          onClick={handleDirectSearch}
          disabled={isGeocoding || !searchTerm.trim()}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 px-2 sm:px-3 text-xs sm:text-sm bg-[var(--cashlap-blue)] hover:bg-[var(--cashlap-blue)]/90 text-white flex-shrink-0"
          size="sm"
        >
          {isGeocoding ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
          >
            {/* Recent Searches */}
            {searchTerm.length === 0 && recentSearches.length > 0 && (
              <div className="p-2 border-b border-gray-100">
                <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Recent Searches</span>
                </div>
                {recentSearches.map((item, index) => {
                  const IconComponent = getTypeIcon(item.type);
                  return (
                    <button
                      key={index}
                      ref={el => suggestionRefs.current[index] = el}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors ${
                        selectedIndex === index ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                      }`}
                      onClick={() => handleSelectSuggestion(item)}
                    >
                      <IconComponent className={`w-4 h-4 ${getTypeColor(item.type)} flex-shrink-0`} />
                      <span className="text-sm text-gray-900 truncate min-w-0">{item.display_name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Live Suggestions */}
            {searchTerm.length >= 2 && (
              <div className="p-2">
                {isLoadingSuggestions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Finding suggestions...</span>
                  </div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => {
                    const IconComponent = getTypeIcon(suggestion.type);
                    const actualIndex = (searchTerm.length === 0 && recentSearches.length > 0) ? index + recentSearches.length : index;
                    
                    return (
                      <button
                        key={index}
                        ref={el => suggestionRefs.current[actualIndex] = el}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors ${
                          selectedIndex === actualIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                        }`}
                        onClick={() => handleSelectSuggestion(suggestion)}
                      >
                        <IconComponent className={`w-4 h-4 ${getTypeColor(suggestion.type)} flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate">{suggestion.display_name}</div>
                          <div className="text-xs text-gray-500 capitalize">{suggestion.type}</div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">
                    No suggestions found. Try a different search term.
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
