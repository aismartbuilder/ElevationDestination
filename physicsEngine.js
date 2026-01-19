/**
 * Fitness Physics Engine
 * Converts Peloton workout data into vertical climb metrics.
 */

export const BIKE_WEIGHT_KG = 61;
export const GRAVITY = 9.8; // m/s^2

/**
 * Calculates vertical elevation gained based on total output and user weight.
 * @param {number} totalOutputKj - Total output in kilojoules.
 * @param {number} userWeightKg - User weight in kilograms.
 * @returns {object} Object containing height in meters and feet, and landmark comparison.
 */
export function calculateElevation(totalOutputKj, userWeightKg) {
    if (totalOutputKj <= 0 || userWeightKg <= 0) {
        return {
            meters: 0,
            feet: 0,
            landmark: "Ready to climb?",
        };
    }

    // Step 1: Convert kJ to Joules
    const energyJoules = totalOutputKj * 1000;

    // Step 2: Calculate Total Mass
    const totalMassKg = userWeightKg + BIKE_WEIGHT_KG;

    // Step 3: Solve for height using PE = mgh -> h = PE / mg
    const heightMeters = energyJoules / (totalMassKg * GRAVITY);

    // Step 4: Convert to feet
    const heightFeet = heightMeters * 3.281;

    return {
        meters: parseFloat(heightMeters.toFixed(2)),
        feet: parseFloat(heightFeet.toFixed(2)),
        landmark: getLandmarkComparison(heightMeters),
    };
}

/**
 * Returns a contextual comparison for the climbed height.
 * @param {number} meters - Height in meters.
 * @returns {string} Comparison string.
 */
function getLandmarkComparison(meters) {
    const landmarks = [
        { name: "Eiffel Tower", height: 330 },
        { name: "Empire State Building", height: 443 },
        { name: "Burj Khalifa", height: 828 },
        { name: "Mount Everest", height: 8849 },
    ];

    // Check for exact multiples or fractions
    // Let's keep it simple: find the closest or most impressive context.

    if (meters < 100) {
        return `That's about ${(meters / 3).toFixed(0)} stories high!`;
    }

    for (const landmark of landmarks) {
        const ratio = meters / landmark.height;
        if (ratio < 1) {
            return `You are ${(ratio * 100).toFixed(1)}% of the way up the ${landmark.name}!`;
        }
        if (ratio < 2) {
            return `You just climbed the ${landmark.name}!`;
        }
    }

    // If huge
    const everestRatio = meters / 8849;
    return `You climbed the equivalent of Mount Everest ${everestRatio.toFixed(1)} times!`;
}
