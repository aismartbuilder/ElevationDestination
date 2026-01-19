
import { calculateElevation } from './physicsEngine.js';

console.log("Running Physics Engine Tests...");

// Test Case 1: Example from plan (approx)
// User: 80kg, Output: 400kJ
// Total Mass: 141kg
// Joules: 400,000
// h = 400000 / (141 * 9.8) = 289.47m
const t1 = calculateElevation(400, 80);
console.log("Test 1 (80kg, 400kJ):", t1);

if (Math.abs(t1.meters - 289.47) < 0.1) {
    console.log("PASS: Meters calculation correct.");
} else {
    console.error("FAIL: Meters calculation incorrect. Expected ~289.47, got " + t1.meters);
}

if (Math.abs(t1.feet - 949.75) < 0.5) { // slightly looser tolerance for feet conversion
    console.log("PASS: Feet calculation correct.");
} else {
    console.error("FAIL: Feet calculation incorrect. Expected ~949.75, got " + t1.feet);
}


// Test Case 2: Zero input
const t2 = calculateElevation(0, 80);
console.log("Test 2 (80kg, 0kJ):", t2);
if (t2.meters === 0) console.log("PASS: Zero input handled.");

// Test Case 3: Landmark - Eiffel Tower (330m)
// Need > 330m. Let's try 500kJ, 80kg -> 361m
const t3 = calculateElevation(500, 80);
console.log("Test 3 (landmark check):", t3.landmark);
