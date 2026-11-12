
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
  },
  {
    id: "prime",
    name: "Prime Check",
    symbol: "prime(",
    categories: ["Number Theory"]
  },
  {
    id: "fact",
    name: "Prime Factorization",
    symbol: "fact(",
    categories: ["Number Theory"]
  },
  {
    id: "gcd",
    name: "Greatest Common Divisor",
    symbol: "gcd(",
    categories: ["Number Theory"]
  },
  {
    id: "lcm",
    name: "Least Common Multiple",
    symbol: "lcm(",
    categories: ["Number Theory"]
  },
  {
    id: "pinc",
    name: "Percent Increase",
    symbol: "pinc(",
    categories: ["Percentages"]
  },
  {
    id: "pdec",
    name: "Percent Decrease",
    symbol: "pdec(",
    categories: ["Percentages"]
  },
  {
    id: "pdiff",
    name: "Percent Difference",
    symbol: "pdiff(",
    categories: ["Percentages"]
  },
  {
    id: "mean",
    name: "Mean",
    symbol: "mean(",
    categories: ["Statistics"]
  },
  {
    id: "medn",
    name: "Median",
    symbol: "medn(",
    categories: ["Statistics"]
  },
  {
    id: "mode",
    name: "Mode",
    symbol: "mode(",
    categories: ["Statistics"]
  },
  {
    id: "stdev",
    name: "Standard Deviation",
    symbol: "stdev(",
    categories: ["Statistics"]
  },
  {
    id: "var",
    name: "Variance",
    symbol: "var(",
    categories: ["Statistics"]
  },
  {
    id: "stats",
    name: "All Statistics",
    symbol: "stats(",
    categories: ["Statistics"]
  }
];

const functionRegistry = new Map(
  calculatorFunctions.map(func => [func.id, func])
);
