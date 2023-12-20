import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Notion API Proxy is running!');
});

// Example endpoint to proxy Notion API requests
app.get('/notion-endpoint', async (req, res) => {
    try {
        // const response = await axios.get('https://api.notion.com/v1/...');
        res.json({
            test: 'test',
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching from Notion API' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
