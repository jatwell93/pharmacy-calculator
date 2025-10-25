# Pharmacy Calculator - Opportunity Analysis Tool

A comprehensive web-based calculator for Australian pharmacies to analyze financial opportunities across government-funded programs, vaccinations, pharmacy services, and biologics dispensary operations.

## 🏗️ Project Structure

```
pharmacy-calculator/
├── index.html              # Main HTML structure (clean, no inline scripts/styles)
├── README.md              # This file
├── netlify.toml           # Netlify deployment configuration
├── css/
│   └── styles.css         # All custom CSS styles
├── js/
│   ├── main.js           # Application entry point and initialization
│   ├── serviceData.js    # Service definitions and data structures
│   ├── calculations.js   # Calculation logic and utilities
│   ├── ui.js             # DOM manipulation and table generation
│   └── aiIntegration.js  # AI-powered action plan generation
└── netlify/
    └── functions/         # Serverless API functions (if any)
```

## 📋 Features

- **Part 1: Government-Funded Programs**
  - DAA (Dose Administration Aid) services
  - Staged Supply programs
  - MedsChecks & Diabetes MedsChecks
  - HMRs (Home Medicines Review)
  - RMMRs (Residential Medication Management Review)
  - Quality Use of Medicines (QUM)
  - Opioid Dependence Treatment (ODT)
  - Take Home Naloxone (THN)

- **Part 2: Vaccinations**
  - COVID-19, Flu, NIPVIP programs
  - Private vaccinations (MMR, dTpa, HPV, etc.)
  - Shingles, RSV, and other specialty vaccines

- **Part 3: Pharmacy Programs & Services**
  - App enrolments
  - UTI and OCP consultations
  - Minor skin conditions
  - Travel health consultations
  - Weight management and sleep studies
  - Wound care and home deliveries

- **Part 4: Biologics Dispensary Opportunity**
  - Adalimumab and Etanercept programs
  - Additional margin calculations
  - Pharmacy program remuneration

## 🚀 Getting Started

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd pharmacy-calculator
   ```

2. Open `index.html` in a modern web browser, or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx http-server
   ```

3. Navigate to `http://localhost:8000` in your browser

### Deployment

This project is configured for deployment on Netlify:

1. Connect your repository to Netlify
2. Build settings are handled automatically via `netlify.toml`
3. Deploy!

## 💻 Code Organization

### `js/serviceData.js`
Contains all service definitions organized by category (part1-4). Each service includes:
- Unique ID
- Display name
- Funded rate information
- Patient fee structures
- Volume defaults
- Custom calculation functions

### `js/calculations.js`
Core calculation logic:
- `formatCurrency()` - Australian dollar formatting
- `calculateAll()` - Recalculates all service values
- `collectCurrentAnalysisData()` - Gathers data for AI analysis

### `js/ui.js`
User interface management:
- `generateTables()` - Dynamically creates service tables
- `setupEventListeners()` - Attaches input change handlers
- `displayPlan()` - Renders AI-generated action plans
- Loading state management

### `js/aiIntegration.js`
AI-powered features:
- `testWithSampleData()` - Test AI with predefined data
- `testWithRealData()` - Generate plans from current calculator data
- API integration for plan generation

### `js/main.js`
Application initialization:
- Module imports
- DOM ready event handling
- Global function exposure for inline handlers

## 🎨 Styling

All styles are in `css/styles.css`:
- Base styles and typography
- Input field styling
- Table layouts
- Result display formatting
- Animation keyframes

Uses **Tailwind CSS** via CDN for utility classes.

## 📊 How to Use

1. **Enter Current Data**: Input your pharmacy's current service volumes
2. **Set Potential Targets**: Enter growth targets in "Potential Volume" fields
3. **Adjust Patient Fees**: Modify patient fees where applicable
4. **View Results**: See real-time calculations of:
   - Estimated Current Value (Yearly)
   - Estimated Additional Value (Yearly)
   - Estimated Total Value (Yearly)

## 🤖 AI Integration

The calculator includes AI-powered action plan generation:

1. Enter your current and potential volumes
2. Click "Test AI with Real Calculator Data"
3. Receive a customized implementation plan with:
   - Financial projections and ROI
   - Timeline with milestones
   - Staffing and training recommendations
   - Marketing strategies

## 🔧 Customization

### Adding a New Service

1. Open `js/serviceData.js`
2. Add service to appropriate part array (part1, part2, part3, or part4)
3. Include all required fields:
   ```javascript
   {
       id: "unique-service-id",
       name: "Service Display Name",
       fundedRateDesc: "$X.XX description",
       fundedRate: 0.00,
       patientFeeCurrent: 0,
       patientFeePotential: 0,
       unit: "per month",
       timeFactor: 12,
       currentVol: 0,
       potentialVol: 0,
       calc: standardCalc,
   }
   ```

### Modifying Calculations

Edit the calculation functions in `js/calculations.js` or create custom calc functions in `js/serviceData.js` for specific services.

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Requires ES6 module support

## 📄 License

[Add your license information here]

## 🤝 Contributing

[Add contribution guidelines here]

## 📞 Support

For questions or support, please [add contact information].

---

**Note**: This calculator provides estimates based on Australian pharmacy program rates. Always verify current rates and eligibility with official sources.