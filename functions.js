/*
 * SEMESTER:        EECS 581 Fall 2026
 * PROJECT:         Project 3 - Calculator
 * FILE:            functions.js
 *
 * DESCRIPTION:     Defines the available calculator functions and their categories.
 *
 * INPUT:           Function definitions used by the calculator.
 * OUTPUT:          Function registry for searching and evaluating supported functions.
 * 
 * COLLABORATORS:   Ivan Kullaya, Gael Salazar-Morales, Gabriel Haro-Villa, Carter Ruff
 * SOURCES:         TBD
 * 
 * AUTHOR:          Carter Ruff
 * CREATION DATE:   11/08/2026
 */

// Function definitions used by the calculator and function search menu.
const calculatorFunctions = [
  {
    id: "sin",
    name: "Sine",
    symbol: "sin(",
    categories: ["Trigonometry"]
  },
  {
    id: "cos",
    name: "Cosine",
    symbol: "cos(",
    categories: ["Trigonometry"]
  },
  {
    id: "tan",
    name: "Tangent",
    symbol: "tan(",
    categories: ["Trigonometry"]
  },
  {
    id: "ln",
    name: "Natural Logarithm",
    symbol: "ln(",
    categories: ["Logarithms"]
  },
  {
    id: "log",
    name: "Logarithm",
    symbol: "log(",
    categories: ["Logarithms"]
  },
  {
    id: "sqrt",
    name: "Square Root",
    symbol: "sqrt(",
    categories: ["Algebra"]
  },
  {
    id: "abs",
    name: "Absolute Value",
    symbol: "abs(",
    categories: ["Algebra"]
  },
  {
    id: "power",
    name: "Exponent",
    symbol: "^",
    categories: ["Algebra"]
  }
];

const functionRegistry = new Map(
  calculatorFunctions.map(func => [func.id, func])
);
