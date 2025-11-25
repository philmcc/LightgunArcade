export class GlobalHighScores {
    constructor() {
        this.storageKey = 'lightgun_arcade_global_scores';
    }

    load() {
        const saved = localStorage.getItem(this.storageKey);
        return saved ? JSON.parse(saved) : [];
    }

    save(scores) {
        localStorage.setItem(this.storageKey, JSON.stringify(scores));
    }

    addScore(gameId, name, score, difficulty) {
        const scores = this.load();
        scores.push({
            game: gameId,
            name: name,
            score: score,
            difficulty: difficulty,
            date: new Date().toISOString()
        });

        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);

        // Keep top 50 scores across all games
        const trimmed = scores.slice(0, 50);
        this.save(trimmed);

        return trimmed;
    }

    getScoresByGame(gameId) {
        const allScores = this.load();
        return allScores.filter(s => s.game === gameId);
    }

    getAllScores() {
        return this.load();
    }

    isHighScore(gameId, score) {
        const gameScores = this.getScoresByGame(gameId);
        if (gameScores.length < 10) return true;
        return score > gameScores[gameScores.length - 1].score;
    }
}
