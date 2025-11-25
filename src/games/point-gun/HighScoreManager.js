export class HighScoreManager {
    constructor() {
        this.maxScores = 10;
        this.scores = this.load();
    }

    load() {
        const saved = localStorage.getItem("pbs_highscores");
        if (saved) {
            return JSON.parse(saved);
        }
        return [];
    }

    save() {
        localStorage.setItem("pbs_highscores", JSON.stringify(this.scores));
    }

    addScore(name, score, difficulty) {
        this.scores.push({
            name: name.substring(0, 10), // Max 10 chars
            score: score,
            difficulty: difficulty,
            date: new Date().toISOString()
        });

        // Sort by score descending
        this.scores.sort((a, b) => b.score - a.score);

        // Keep only top 10
        this.scores = this.scores.slice(0, this.maxScores);

        this.save();
    }

    isHighScore(score) {
        if (this.scores.length < this.maxScores) return true;
        return score > this.scores[this.scores.length - 1].score;
    }

    getScores() {
        return this.scores;
    }

    getScoresByDifficulty(difficulty) {
        return this.scores.filter(s => s.difficulty === difficulty);
    }
}
