# EECS 581 - Group 20 Project 3

## All-in-one Calculator

**Agile Software Development and Multi-Function Calculator Application**  
University of Kansas | Fall 2026

## Table of Contents

- [About The Project](#about-the-project)
- [Current Implementation](#current-implementation)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Sprint Plan](#sprint-plan)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Testing](#testing)
- [Team Members](#team-members)
- [Acknowledgments](#acknowledgments)

## About The Project

This project is developed as part of **EECS 581 – Software Engineering II** at the University of Kansas, taught by Professor Hossein Saiedian.

For Project 3, Group 20 is designing and developing an **All-in-one Calculator** using an agile development process. The goal is to combine basic arithmetic, scientific calculations, financial tools, unit conversions, graphing, and other mathematical utilities in one accessible application.

Development is organized into sprints, with each sprint producing working software and preparing requirements artifacts for the next iteration.

## Current Implementation

The current repository snapshot contains a browser-based scientific calculator built with **HTML, CSS, and JavaScript**.

### Expression Parsing and Evaluation

- Basic arithmetic: addition, subtraction, multiplication, and division
- Parentheses and standard operator precedence
- Exponentiation and unary positive/negative signs
- Implicit multiplication (for example, `2(3+4)`)
- Mathematical constants `π` and `e`
- Scientific functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `ln`, `log`, `exp`, and `abs`
- Degrees/radians toggle for trigonometric calculations

### User Interface

- On-screen calculator buttons and text input
- Live result preview while entering expressions
- Clear and backspace controls
- Keyboard support, including Enter to calculate
- Responsive layout and light/dark appearance based on system preferences
- Animated particle background when the external particles.js library is available

### Calculation Feedback

- Helpful error messages for invalid expressions and mathematical domain errors
- Error locations displayed by column, with the relevant expression segment underlined
- Expandable calculation steps for supported expressions
- Reuse of the previous result when beginning a new expression with an operator

## Getting Started

### Prerequisites

- A modern web browser with JavaScript enabled
- Git (optional, for cloning the repository)
- An internet connection for the optional particles.js background effect

### Installation

1. Clone the Project 3 GitHub repository or download its files.
2. Open the repository folder.
3. Open `index.html` in a web browser.

No package installation or build command is required for the three-file implementation shown in the current snapshot.

## Usage

Enter an expression in the input field or use the on-screen buttons. Press **=** or **Enter** to calculate. The result is shown below the expression.

Examples:

| Expression | Expected result |
|:---:|:---:|
| `2+3*4` | `14` |
| `(2+3)*4` | `20` |
| `sqrt(81)` | `9` |
| `2^5` | `32` |
| `sin(π/2)` in Rad mode | `1` |
| `sin(30)` in Deg mode | `0.5` |

Use **AC** to clear the expression, **⌫** to remove input, and **Rad/Deg** to change angle units. After a successful calculation, expand **Show steps** when available to view the calculation breakdown.

## Sprint Plan

### Sprint 1 — Initial Calculator Foundation

The initial requirements stack assigns these requirements to Sprint 1:

| ID | Requirement | Story points | Status in supplied code |
|:---:|:---:|:---:|:---:|
| 1 | Expression parser | 1 | Implemented in supplied snapshot; verification pending |
| 2 | Arbitrary-precision calculation engine | 1 | Not yet met; standard floating-point arithmetic used |
| 3 | Persistent session history and Ans recall | 1 | Not yet demonstrated |
| 4 | Unit conversion | 2 | Not yet demonstrated |
| 5 | Clean, user-friendly UI layout | 2 | Initial interface implemented; review pending |
| 6 | 2D single-variable graphing | 2 | Not yet demonstrated |
| 7 | Calculation mode switcher | 1 | Not yet demonstrated |
| 8 | Function search and category filter | 1 | Not yet demonstrated |

**Planned Sprint 1 total: 11 story points.** This table describes the supplied snapshot, not a final sprint acceptance decision. Update it after integrating teammates' work and completing tests.

### Subsequent Sprints

The remaining requirements backlog includes financial calculations, calculation explanations, editing history, number theory, statistics, fractions, percentages, algebra solving, graph customization, programmer tools, matrix operations, calculus, saved calculations, export options, and display preferences.

The team will prioritize and assign these features to subsequent sprints based on available capacity and approved requirements artifacts.

### Submission Milestones

- **November 8, 2026:** Sprint 1 Release and Sprint 2 Requirements
- **November 22, 2026:** Sprint 2 Release and Sprint 3 Requirements
- **November 29, 2026:** Sprint 3 Release and Final Sprint Requirements

Each sprint submission includes a GitHub release link, an updated requirements stack, and requirements artifacts for the next sprint.

## Architecture

The planned architecture separates the calculator into components so additional mathematical features can be developed and integrated without redesigning the entire application.

Planned components include:

- **Calculator UI:** Expression entry, buttons, results, modes, and settings
- **Expression Parser:** Tokenization, syntax checking, and operator precedence
- **Calculation Engine:** Evaluation of mathematical expressions
- **Specialized Tools:** Financial, conversion, graphing, and advanced math functions
- **History and Settings:** Saved results, previous calculations, and preferences

The current code implements the UI, parser, and evaluation logic primarily within `script.js`. Other planned components will be integrated during development.

The team's **Initial Architecture Document** contains component, class, and sequence diagrams describing the intended system structure and calculation workflow.

## Repository Structure

The supplied implementation currently contains:

- `index.html` — Calculator page and controls
- `script.js` — Parser, evaluation, steps, and UI interactions
- `styles.css` — Responsive layout and visual styling
- `/docs` - Meeting logs, Architecture and Requirement Artifacts Documents
- `README.md` — Project documentation

Additional documentation, tests, and feature modules may be added as the project progresses.

## Testing

The team should verify each implemented requirement against its acceptance criteria and record actual results before marking it complete.

Suggested checks for the current implementation include:

- Arithmetic precedence and parentheses
- Scientific functions in radians and degrees
- Implicit multiplication and exponentiation
- Invalid input, unknown functions, and unmatched parentheses
- Division by zero and invalid square-root/logarithm inputs
- Keyboard and on-screen button interactions
- Calculation steps and responsive layout

**Testing status:** The uploaded requirements verification artifacts contain proposed test cases, not executed test evidence.

## Team Members

**Group 20**

- Ivan Kullaya
- Pruthviraj Sadhankar
- Liam Kinghouser
- Gael Salazar-Morales
- Joshua Fakunmoju
- Gabriel Haro-Villa
- Carter Ruff

## Acknowledgments

Developed for **EECS 581 – Software Engineering II**, Fall 2026, at the University of Kansas under **Professor Hossein Saiedian**.

The current interface references the third-party **particles.js** library for its optional animated background.
