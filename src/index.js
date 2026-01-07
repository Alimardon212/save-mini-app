// Cloudflare Worker kodi (index.js)

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONS request uchun
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  // POST request - javoblarni saqlash
  if (request.method === 'POST') {
    try {
      const data = await request.json();
      console.log("Qabul qilingan ma'lumotlar:", JSON.stringify(data, null, 2));
      
      // Ma'lumotlarni tekshirish
      if (!data.userId || !data.answers) {
        return new Response(JSON.stringify({
          success: false,
          error: "userId va answers majburiy"
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Yopiq va ochiq javoblarni ajratish
      const closedAnswers = {};
      const openAnswers = {};
      
      Object.keys(data.answers).forEach(key => {
        const qNum = parseInt(key);
        if (qNum <= (data.testInfo?.closedQuestions || 30)) {
          closedAnswers[key] = data.answers[key];
        } else {
          openAnswers[key] = data.answers[key];
        }
      });
      
      console.log("Yopiq javoblar:", closedAnswers);
      console.log("Ochiq javoblar:", openAnswers);
      
      // Unique ID yaratish
      const id = `${data.userId}_${Date.now()}`;
      const saveData = {
        id: id,
        userId: data.userId,
        userName: data.userName || "Foydalanuvchi",
        timestamp: data.timestamp || new Date().toISOString(),
        testInfo: data.testInfo,
        answers: data.answers,
        closedAnswers: closedAnswers,
        openAnswers: openAnswers,
        openAnswersCount: Object.keys(openAnswers).length,
        closedAnswersCount: Object.keys(closedAnswers).length
      };
      
      // KV ga yozish
      await ANSWERS_KV.put(id, JSON.stringify(saveData));
      
      // Oxirgi 10 ta natijani saqlash
      await saveRecent(data.userId, id);
      
      return new Response(JSON.stringify({
        success: true,
        message: "Javoblar muvaffaqiyatli saqlandi",
        savedId: id,
        stats: {
          total: Object.keys(data.answers).length,
          closed: Object.keys(closedAnswers).length,
          open: Object.keys(openAnswers).length
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error("Xato:", error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  // GET request - ma'lumotlarni olish (debug uchun)
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (userId) {
      // Foydalanuvchining oxirgi javoblarini olish
      const recentKey = `recent_${userId}`;
      const recent = await ANSWERS_KV.get(recentKey, 'json');
      
      return new Response(JSON.stringify({
        success: true,
        recent: recent || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: "userId kerak"
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response("Not found", { 
    status: 404,
    headers: corsHeaders
  });
}

// Foydalanuvchining oxirgi javoblarini saqlash
async function saveRecent(userId, newId) {
  const recentKey = `recent_${userId}`;
  let recent = [];
  
  try {
    const existing = await ANSWERS_KV.get(recentKey, 'json');
    if (existing && Array.isArray(existing)) {
      recent = existing;
    }
  } catch (e) {
    console.log("Yangi recent array yaratildi");
  }
  
  // Yangi ID ni boshiga qo'shish
  recent.unshift(newId);
  
  // Faqat oxirgi 10 tasini saqlash
  if (recent.length > 10) {
    recent = recent.slice(0, 10);
  }
  
  // KV ga saqlash
  await ANSWERS_KV.put(recentKey, JSON.stringify(recent));
}
