import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SANITY_PROJECT_ID = "5a03o7rz";
const SANITY_DATASET = "production";

// Agar kerak bo'lsa, sanityClient yoki readToken bilan authorized fetch qilamiz (hozir oddiy public query yozamiz)

// Sanity'dan to'liq contentni olish uchun so'rov:
const fetchPostFromSanity = async (documentId) => {
  try {
    const query = `*[_id == "${documentId}"][0]{
      uzTitle,
      uzContent,
      "mainImageUrl": mainImage.asset->url
    }`;
    
    const encodedQuery = encodeURIComponent(query);
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2021-03-25/data/query/${SANITY_DATASET}?query=${encodedQuery}`;
    
    const response = await axios.get(url);
    return response.data.result;
  } catch (error) {
    console.error("Sanity fetch error:", error.response?.data || error.message);
    return null;
  }
};

// Telegramga yuborish
const sendPostToTelegram = async (post) => {
  try {
    const text = `
<b>${post.uzTitle}</b>

${post.uzContent ? (Array.isArray(post.uzContent) ? post.uzContent.map(block => block.children?.map(child => child.text).join("")).join("\n") : post.uzContent) : ''}

<b>Ko'proq ko'rish uchun:</b> mavlonbek.com
    `;

    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

    // Agar rasm bo'lsa rasm bilan yuboramiz
    if (post.mainImageUrl) {
      await axios.post(`${telegramApiUrl}/sendPhoto`, {
        chat_id: TELEGRAM_CHAT_ID,
        photo: post.mainImageUrl,
        caption: text,
        parse_mode: "HTML",
      });
    } else {
      // Faqat text yuboramiz
      await axios.post(`${telegramApiUrl}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("Telegram error:", error.response?.data || error.message);
  }
};

// Endi webhook qabul qilamiz:
app.post("/api/telegram", async (req, res) => {
  const { body } = req;

  const documentId = body?.ids?.[0];

  if (!documentId) {
    return res.status(400).json({ message: "Document ID topilmadi" });
  }

  const post = await fetchPostFromSanity(documentId);

  if (post) {
    await sendPostToTelegram(post);
    res.status(200).json({ message: "Telegramga yuborildi!" });
  } else {
    res.status(404).json({ message: "Post topilmadi" });
  }
});

// Serverni ishga tushuramiz
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});