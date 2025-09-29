// js/autocomplete.js
// City Autocomplete functionality for Construction Risk Assessment App

const georgianCities = [
    // Georgia cities (20k+ population)
    { city: "Atlanta", state: "Georgia", lat: 33.7490, lon: -84.3880 },
    { city: "Augusta", state: "Georgia", lat: 33.4735, lon: -82.0105 },
    { city: "Columbus", state: "Georgia", lat: 32.4609, lon: -84.9877 },
    { city: "Macon", state: "Georgia", lat: 32.8407, lon: -83.6324 },
    { city: "Savannah", state: "Georgia", lat: 32.0809, lon: -81.0912 },
    { city: "Athens", state: "Georgia", lat: 33.9519, lon: -83.3576 },
    { city: "South Fulton", state: "Georgia", lat: 33.6326, lon: -84.5700 },
    { city: "Sandy Springs", state: "Georgia", lat: 33.9245, lon: -84.3785 },
    { city: "Roswell", state: "Georgia", lat: 34.0234, lon: -84.3617 },
    { city: "Johns Creek", state: "Georgia", lat: 34.0289, lon: -84.1989 },
    { city: "Warner Robins", state: "Georgia", lat: 32.6130, lon: -83.5999 },
    { city: "Albany", state: "Georgia", lat: 31.5785, lon: -84.1557 },
    { city: "Alpharetta", state: "Georgia", lat: 34.0754, lon: -84.2941 },
    { city: "Marietta", state: "Georgia", lat: 33.9526, lon: -84.5499 },
    { city: "Stonecrest", state: "Georgia", lat: 33.6856, lon: -84.1418 },
    { city: "Valdosta", state: "Georgia", lat: 30.8327, lon: -83.2785 },
    { city: "Smyrna", state: "Georgia", lat: 33.8839, lon: -84.5144 },
    { city: "Dunwoody", state: "Georgia", lat: 33.9462, lon: -84.3346 },
    { city: "Brookhaven", state: "Georgia", lat: 33.8651, lon: -84.3366 },
    { city: "Peachtree Corners", state: "Georgia", lat: 33.9699, lon: -84.2214 },
    { city: "Gainesville", state: "Georgia", lat: 34.2979, lon: -83.8241 },
    { city: "Peachtree City", state: "Georgia", lat: 33.3968, lon: -84.5963 },
    { city: "Newnan", state: "Georgia", lat: 33.3801, lon: -84.7997 },
    { city: "Milton", state: "Georgia", lat: 34.1324, lon: -84.3007 },
    { city: "East Point", state: "Georgia", lat: 33.6796, lon: -84.4394 },
    { city: "Kennesaw", state: "Georgia", lat: 34.0234, lon: -84.6155 },
    { city: "Duluth", state: "Georgia", lat: 34.0029, lon: -84.1446 },
    { city: "Carrollton", state: "Georgia", lat: 33.5801, lon: -85.0766 },
    { city: "Griffin", state: "Georgia", lat: 33.2468, lon: -84.2641 },
    { city: "Lawrenceville", state: "Georgia", lat: 33.9563, lon: -83.9880 },
    { city: "Union City", state: "Georgia", lat: 33.5871, lon: -84.5424 },
    { city: "Canton", state: "Georgia", lat: 34.2368, lon: -84.4907 },
    { city: "McDonough", state: "Georgia", lat: 33.4473, lon: -84.1469 },
    { city: "Acworth", state: "Georgia", lat: 34.0621, lon: -84.6769 },
    { city: "Pooler", state: "Georgia", lat: 32.1155, lon: -81.2468 },
    { city: "Sugar Hill", state: "Georgia", lat: 34.1096, lon: -84.0338 },
    { city: "Rome", state: "Georgia", lat: 34.2570, lon: -85.1647 },
    { city: "Woodstock", state: "Georgia", lat: 34.1015, lon: -84.5194 },
    { city: "Chamblee", state: "Georgia", lat: 33.8862, lon: -84.3041 },
    { city: "Cartersville", state: "Georgia", lat: 34.1651, lon: -84.7999 },
    { city: "Tucker", state: "Georgia", lat: 33.8540, lon: -84.2171 },
    { city: "Douglasville", state: "Georgia", lat: 33.7515, lon: -84.7477 },
    { city: "Statesboro", state: "Georgia", lat: 32.4488, lon: -81.7832 }
];

class CityAutocomplete {
    constructor() {
        this.cities = georgianCities;
        this.selectedCity = null;
        this.highlightedIndex = -1;
        this.initializeAutocomplete();
    }

    initializeAutocomplete() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.input = document.getElementById('siteAddress');
        if (!this.input) {
            console.error('Site address input not found');
            return;
        }

        // Create dropdown if it doesn't exist
        let dropdown = document.getElementById('suggestionsDropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'suggestionsDropdown';
            dropdown.className = 'suggestions-dropdown';
            this.input.parentNode.style.position = 'relative';
            this.input.parentNode.appendChild(dropdown);
        }
        this.dropdown = dropdown;

        // Add CSS styles if not already present
        this.addStyles();

        // Set up event listeners
        this.setupEventListeners();
    }

    addStyles() {
        if (document.getElementById('autocomplete-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'autocomplete-styles';
        styles.textContent = `
            .suggestions-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 2px solid #e1e5e9;
                border-top: none;
                border-radius: 0 0 8px 8px;
                max-height: 250px;
                overflow-y: auto;
                display: none;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                margin-top: -2px;
            }
            
            .suggestions-dropdown.active {
                display: block;
            }
            
            .suggestion-item {
                padding: 12px 15px;
                cursor: pointer;
                transition: background-color 0.2s ease;
                border-bottom: 1px solid #f0f0f0;
                display: flex;
                align-items: center;
            }
            
            .suggestion-item:last-child {
                border-bottom: none;
            }
            
            .suggestion-item:hover,
            .suggestion-item.highlighted {
                background-color: #f5f7ff;
            }
            
            .suggestion-icon {
                margin-right: 10px;
                color: #667eea;
            }
            
            .city-name {
                font-weight: 600;
                color: #333;
            }
            
            .state-name {
                color: #666;
                font-size: 14px;
                margin-left: 5px;
            }
            
            .no-results {
                padding: 15px;
                text-align: center;
                color: #666;
                font-style: italic;
            }
        `;
        document.head.appendChild(styles);
    }

    setupEventListeners() {
        // Input event for filtering
        this.input.addEventListener('input', (e) => this.handleInput(e));

        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Click event for suggestions
        this.dropdown.addEventListener('click', (e) => this.handleSuggestionClick(e));

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#siteAddress') && !e.target.closest('#suggestionsDropdown')) {
                this.closeDropdown();
            }
        });

        // Focus event
        this.input.addEventListener('focus', () => {
            if (this.input.value.length >= 2) {
                const suggestions = this.filterCities(this.input.value);
                this.displaySuggestions(suggestions);
            }
        });
    }

    handleInput(e) {
        const value = e.target.value;
        
        if (value.length < 2) {
            this.closeDropdown();
            this.selectedCity = null;
            return;
        }

        const suggestions = this.filterCities(value);
        this.displaySuggestions(suggestions);
    }

    handleKeydown(e) {
        const items = this.dropdown.querySelectorAll('.suggestion-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.highlightedIndex = Math.min(this.highlightedIndex + 1, items.length - 1);
                this.updateHighlight(items);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
                this.updateHighlight(items);
                break;
            case 'Enter':
                if (this.highlightedIndex >= 0 && items[this.highlightedIndex]) {
                    e.preventDefault();
                    const suggestions = this.filterCities(this.input.value);
                    if (suggestions[this.highlightedIndex]) {
                        this.selectCity(suggestions[this.highlightedIndex]);
                    }
                }
                break;
            case 'Escape':
                this.closeDropdown();
                break;
        }
    }

    handleSuggestionClick(e) {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            const index = parseInt(item.dataset.index);
            const suggestions = this.filterCities(this.input.value);
            if (suggestions[index]) {
                this.selectCity(suggestions[index]);
            }
        }
    }

    filterCities(searchTerm) {
        const term = searchTerm.toLowerCase();
        return this.cities
            .filter(city => 
                city.city.toLowerCase().includes(term) || 
                city.state.toLowerCase().includes(term)
            )
            .slice(0, 8);
    }

    displaySuggestions(suggestions) {
        if (suggestions.length === 0) {
            this.dropdown.innerHTML = '<div class="no-results">No cities found</div>';
            this.dropdown.classList.add('active');
            return;
        }

        this.dropdown.innerHTML = suggestions.map((city, index) => `
            <div class="suggestion-item" data-index="${index}">
                <span class="suggestion-icon">📍</span>
                <div class="suggestion-text">
                    <span class="city-name">${city.city}</span>,
                    <span class="state-name">${city.state}</span>
                </div>
            </div>
        `).join('');

        this.dropdown.classList.add('active');
        this.highlightedIndex = -1;
    }

    updateHighlight(items) {
        items.forEach((item, index) => {
            if (index === this.highlightedIndex) {
                item.classList.add('highlighted');
            } else {
                item.classList.remove('highlighted');
            }
        });
    }

    selectCity(city) {
        this.selectedCity = city;
        this.input.value = `${city.city}, ${city.state}`;
        this.input.dataset.lat = city.lat;
        this.input.dataset.lon = city.lon;
        this.closeDropdown();
        
        // Trigger change event so your form knows a city was selected
        const event = new Event('change', { bubbles: true });
        this.input.dispatchEvent(event);
    }

    closeDropdown() {
        this.dropdown.classList.remove('active');
        this.highlightedIndex = -1;
    }

    getSelectedCity() {
        return this.selectedCity;
    }
}

// Initialize the autocomplete when this script loads
const cityAutocomplete = new CityAutocomplete();
