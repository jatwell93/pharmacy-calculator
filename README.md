# Pharmacy Calculator - Opportunity Analysis Tool

A comprehensive web-based calculator for Australian pharmacies to analyze financial opportunities across government-funded programs, vaccinations, pharmacy services, and biologics dispensary operations. The project's goal is to offer an open source transparent platform for pharmacies to analsze their financial opportunities under the new CPA 8.

## Project Structure

```
pharmacy-calculator/
├── index.html              # Main HTML structure (clean, no inline scripts/styles)
├── original_calc.html      # Original calculator version (archived)
├── README.md              # This file
├── DEBUG_GUIDE.md         # Debugging and development guide
├── package.json           # Node.js dependencies and scripts
├── .gitignore             # Git ignore rules
├── eslint.config.mjs      # ESLint configuration
├── netlify.toml           # Netlify deployment configuration
├── css/
│   └── styles.css         # All custom CSS styles
├── js/
│   ├── main.js           # Application entry point and initialization
│   ├── serviceData.js    # Service definitions and data structures
│   ├── calculations.js   # Calculation logic and utilities
│   ├── ui.js             # DOM manipulation and table generation
│   └── aiIntegration.js  # AI-powered action plan generation
├── dev/
│   ├── local-server.js    # Local development server
│   └── localDatabase.js   # File-backed database for local testing
├── test/
│   └── calculations.test.js # Unit tests for calculations
├── netlify/
│   └── functions/         # Serverless API functions
│       ├── generate-plan.js
│       ├── generate-plan-background.js
│       └── check-plan-status.js
└── .netlify/              # Netlify build output (auto-generated)
```

## Features

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

## Get Started

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd pharmacy-calculator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Navigate to `http://localhost:8888` in your browser (or the URL shown in the console)

### Deployment

This project is configured for deployment on Netlify:

1. Connect your repository to Netlify
2. Build settings are handled automatically via `netlify.toml`
3. Deploy!

#### Environment Variables

For the AI features to work in production, set the following environment variables in your Netlify dashboard:

- `OPENROUTER_API_KEY`: Your OpenRouter API key (required for AI plan generation). Obtain from [openrouter.ai](https://openrouter.ai/)

Optional Firebase configuration (recommended for production use; if not set, a local file-based database is used for development, which is not suitable for production):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

You can find these values in your Firebase project settings.

## Code Organization

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

## Styling

All styles are in `css/styles.css`:
- Base styles and typography
- Input field styling
- Table layouts
- Result display formatting
- Animation keyframes

Uses **Tailwind CSS** via CDN for utility classes.

## How to Use

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

## Customisation

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


## License

Mozilla Public License Version 2.0

## Contributing

We welcome all types of contributions including bug reports, feature suggestions, documentation improvements, and code changes.

To contribute, please follow these steps:

1. Fork the repository and create a new branch for your changes.
2. Ensure your changes follow the existing code style.
3. Test your changes thoroughly.
4. Open a Pull Request (PR) describing your changes in detail.

When submitting a PR, please use the following template to provide all necessary information:

```markdown
<!--- Provide a general summary of your changes in the Title above -->

## Description
<!--- Describe your changes in detail -->

## Motivation and Context
<!--- Why is this change required? What problem does it solve? -->
<!--- If it fixes an open issue, please link to the issue here. -->

## How has this been tested?
<!--- Please describe in detail how you tested your changes. -->
<!--- Include details of your testing environment, tests ran, and effects -->

## Screenshots (if appropriate):

## Types of changes
<!--- What types of changes does your code introduce? Put an `x` in all the boxes that apply: -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)

## Checklist:
<!--- Go over all the following points, and put an `x` in all the boxes that apply. -->
- [ ] My code follows the code style of this project.
- [ ] My change requires a change to the documentation.
- [ ] I have updated the documentation accordingly.
- [ ] I have added tests to cover my changes.
- [ ] All new and existing tests passed.
```

By following this guide, you help maintain the quality and stability of the project. If you have any questions, feel free to open an issue or reach out.

## Support

### Reporting Issues

If you encounter any problems or bugs while using this calculator, please open a new issue on GitHub.
To help us resolve your issue faster, please use the template below when creating your report:

```markdown
## Who is the bug affecting?
<!-- Ex. All supervisors, Sally Supervisor, Level 1 CCs -->

## What is affected by this bug?
<!-- Ex. AI response, editing services, wrong calculations -->

## When does this occur?
<!-- Ex. On form submission, after upgrade, intermittently -->

## Where does it happen?
<!-- Ex. Settings page, RMMR section, Firefox browser -->

## How do we replicate the issue?
<!-- Please be as specific as possible. Use dashes (-) or numbers (1.) to create a list of steps -->

## Expected behavior (i.e. solution)
<!-- What should have happened? -->

## Other Comments
```

**Process:**
1. Go to the [Issues tab](https://github.com/jatwell93/pharmacy-calculator/issues) of this repository.
2. Click “New issue”.
3. Copy and fill in the above template.
4. Provide as much detail as possible, including screenshots or logs if helpful.

Thank you for helping improve this project!

---

**Note**: This calculator provides estimates based on Australian pharmacy program rates. Always verify current rates and eligibility with official sources.
