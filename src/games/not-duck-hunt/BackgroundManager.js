export class BackgroundManager {
    constructor() {
        this.backgrounds = [
            {
                name: 'Forest Marsh',
                gradient: ['#4a7c59', '#2d5a3d'], // Green forest tones
                color: '#5a8f6a'
            },
            {
                name: 'Mountain Lake',
                gradient: ['#ff6b6b', '#ee5a6f', '#4a7ba7'], // Sunset to blue
                color: '#7a9bc7'
            },
            {
                name: 'Prairie',
                gradient: ['#87CEEB', '#f4e4c1'], // Sky blue to tan
                color: '#d4c4a1'
            },
            {
                name: 'Coastal',
                gradient: ['#6eb5d4', '#b8d4e6'], // Ocean blues
                color: '#8ec5de'
            },
            {
                name: 'Autumn Woods',
                gradient: ['#d97737', '#8b4513', '#4a3616'], // Orange to brown
                color: '#aa6539'
            }
        ];

        this.currentIndex = 0;
    }

    setForRound(roundNumber) {
        // Change background every 2 rounds
        this.currentIndex = Math.floor((roundNumber - 1) / 2) % this.backgrounds.length;
    }

    getCurrentBackground() {
        return this.backgrounds[this.currentIndex];
    }

    draw(ctx, width, height) {
        const bg = this.getCurrentBackground();

        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        bg.gradient.forEach((color, index) => {
            gradient.addColorStop(index / (bg.gradient.length - 1), color);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Draw simple ground line
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, height * 0.75, width, height * 0.25);

        // Draw some simple cloud shapes for atmosphere
        this.drawClouds(ctx, width, height);
    }

    drawClouds(ctx, width, height) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

        // Draw 3 simple clouds
        for (let i = 0; i < 3; i++) {
            const x = (width / 4) * (i + 0.5);
            const y = height * (0.15 + i * 0.1);

            // Cloud made of circles
            ctx.beginPath();
            ctx.arc(x, y, 40, 0, Math.PI * 2);
            ctx.arc(x + 30, y - 10, 35, 0, Math.PI * 2);
            ctx.arc(x + 60, y, 40, 0, Math.PI * 2);
            ctx.arc(x + 30, y + 10, 30, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
