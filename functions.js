
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
