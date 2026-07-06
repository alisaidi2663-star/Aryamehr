import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Ensure folders exist
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const ALBUMS_FILE = path.join(DATA_DIR, "albums.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(ALBUMS_FILE)) {
  fs.writeFileSync(ALBUMS_FILE, JSON.stringify([], null, 2), "utf-8");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for Base64 files
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  // Serve static uploads
  app.use("/uploads", express.static(UPLOADS_DIR));

  // --- API Routes for Albums ---

  // 1. Get all albums list
  app.get("/api/albums", (req, res) => {
    try {
      if (fs.existsSync(ALBUMS_FILE)) {
        const fileContent = fs.readFileSync(ALBUMS_FILE, "utf-8");
        const albums = JSON.parse(fileContent);
        return res.json(albums);
      }
      return res.json([]);
    } catch (error) {
      console.error("Error reading albums.json:", error);
      res.status(500).json({ error: "Failed to load albums." });
    }
  });

  // 2. Get single album detail
  app.get("/api/albums/:id", (req, res) => {
    try {
      const albumId = req.params.id;
      if (fs.existsSync(ALBUMS_FILE)) {
        const fileContent = fs.readFileSync(ALBUMS_FILE, "utf-8");
        const albums = JSON.parse(fileContent);
        const album = albums.find((a: any) => a.id === albumId);
        if (album) {
          return res.json(album);
        }
      }
      return res.status(404).json({ error: "Album not found" });
    } catch (error) {
      console.error("Error finding album:", error);
      res.status(500).json({ error: "Failed to fetch album info" });
    }
  });

  // 3. Save new album
  app.post("/api/albums", async (req, res) => {
    try {
      const { title, creator, images, music, musicName } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      const albumId = `album-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const albumFolder = path.join(UPLOADS_DIR, albumId);
      fs.mkdirSync(albumFolder, { recursive: true });

      const savedImageUrls: string[] = [];

      // Save each image
      if (Array.isArray(images)) {
        for (let i = 0; i < images.length; i++) {
          const imgBase64 = images[i]; // e.g., "data:image/jpeg;base64,..."
          if (imgBase64 && imgBase64.includes(";base64,")) {
            const matches = imgBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const buffer = Buffer.from(matches[2], "base64");
              const ext = matches[1].split("/")[1] || "jpg";
              const filename = `image_${i}.${ext}`;
              const filepath = path.join(albumFolder, filename);
              fs.writeFileSync(filepath, buffer);
              savedImageUrls.push(`/uploads/${albumId}/${filename}`);
            }
          } else if (imgBase64 && (imgBase64.startsWith("/uploads/") || imgBase64.startsWith("http"))) {
            // Keep existing URL
            savedImageUrls.push(imgBase64);
          }
        }
      }

      let savedMusicUrl: string | null = null;
      // Save music if provided
      if (music && music.includes(";base64,")) {
        const matches = music.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const buffer = Buffer.from(matches[2], "base64");
          const filename = "music.mp3";
          const filepath = path.join(albumFolder, filename);
          fs.writeFileSync(filepath, buffer);
          savedMusicUrl = `/uploads/${albumId}/${filename}`;
        }
      } else if (music && (music.startsWith("/uploads/") || music.startsWith("http"))) {
        // Keep existing URL
        savedMusicUrl = music;
      }

      const newAlbum = {
        id: albumId,
        title,
        creator: creator || "آیدین سعیدی",
        images: savedImageUrls,
        music: savedMusicUrl,
        musicName: musicName || (savedMusicUrl ? "music.mp3" : null),
        createdAt: Date.now()
      };

      // Append to list
      let albumsList = [];
      if (fs.existsSync(ALBUMS_FILE)) {
        const fileContent = fs.readFileSync(ALBUMS_FILE, "utf-8");
        albumsList = JSON.parse(fileContent);
      }
      albumsList.push(newAlbum);
      fs.writeFileSync(ALBUMS_FILE, JSON.stringify(albumsList, null, 2), "utf-8");

      res.json({ success: true, album: newAlbum });
    } catch (error) {
      console.error("Error saving album:", error);
      res.status(500).json({ error: "Failed to save album to server" });
    }
  });

  // API Route to proxy Gemini API calls safely on the server side
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "کلید API برای جمینای یافت نشد. لطفا از بخش تنظیمات نسبت به پیکربندی آن اقدام فرمایید."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const { prompt, systemInstruction, isJson, jsonSchema } = req.body;

      const config: any = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (isJson) {
        config.responseMimeType = "application/json";
        if (jsonSchema) {
          config.responseSchema = jsonSchema;
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: config
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Proxy Error:", error);
      res.status(500).json({ error: error?.message || "خطایی در برقراری ارتباط با هوش مصنوعی رخ داد." });
    }
  });

  // Serve static files or Vite dev server middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running and listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
