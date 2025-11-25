
export const getChipColor = (value: number): string => {
    if (value >= 1000) return '#f97316'; // Orange
    if (value >= 500) return '#a855f7'; // Purple
    if (value >= 100) return '#1f2937'; // Black/Dark Gray
    if (value >= 25) return '#22c55e'; // Green
    if (value >= 5) return '#ef4444'; // Red
    return '#ffffff'; // White
};

export const getChipTextColor = (value: number): string => {
    // if (value >= 100 && value < 500) return '#ffffff'; // White text for black chips
    return '#000000';
};

export const createChipTextureURI = (value: number | string, color: string, textColor: string = '#000000'): string => {
    const size = 512;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2; // Full size, no margin
    
    // Stripe pattern for the edge
    const stripes = [0, 60, 120, 180, 240, 300].map(angle => {
        return `<rect x="${cx - 20}" y="0" width="40" height="80" fill="white" transform="rotate(${angle} ${cx} ${cy})" />`;
    }).join('');

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <!-- Main Body -->
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" />
        
        <!-- Edge Stripes -->
        ${stripes}
        
        <!-- Inner Ring -->
        <circle cx="${cx}" cy="${cy}" r="${radius * 0.7}" fill="none" stroke="white" stroke-width="4" stroke-dasharray="20, 10" />
        
        <!-- Center Circle -->
        <circle cx="${cx}" cy="${cy}" r="${radius * 0.45}" fill="white" stroke="${color}" stroke-width="2" />
        
        <!-- Value Text -->
        <text x="${cx}" y="${cy}" font-family="Arial, sans-serif" font-weight="bold" font-size="120" fill="${textColor}" text-anchor="middle" dominant-baseline="central">
            ${value}
        </text>
    </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const calculateChipStack = (amount: number) => {
    const denominations = [1000, 500, 100, 25, 5, 1];
    const stack: number[] = [];
    let remaining = amount;

    for (const denom of denominations) {
        const count = Math.floor(remaining / denom);
        for (let i = 0; i < count; i++) {
            stack.push(denom);
        }
        remaining %= denom;
    }

    // Limit stack size for visual clarity if needed, or just return all
    // For 3D rendering, we might want to cap it or split into multiple stacks if it's too huge.
    // For now, let's return the top 20 chips if it's huge, or just the stack.
    // But actually, in poker, you usually want to see the high value chips on top? Or bottom?
    // Usually high value chips are visible.
    // Let's just return the stack. The renderer can decide how to display.
    return stack.reverse(); // Smallest on bottom? Or largest? Usually random or sorted. Let's sort by value.
};
