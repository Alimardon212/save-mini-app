// src/index.js

export default {
  async fetch(request, env) {
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
        
        const userId = data.userId.toString();
        const timestamp = data.timestamp || new Date().toISOString();
        
        // Yopiq va ochiq javoblarni ajratish
        const numClosed = data.testInfo?.closedQuestions || 30;
        const numOpen = data.testInfo?.openQuestions || 5;
        
        const closedAnswers = {};
        const openAnswers = {};
        
        Object.keys(data.answers).forEach(key => {
          const qNum = parseInt(key);
          if (qNum <= numClosed) {
            closedAnswers[key] = data.answers[key];
          } else {
            openAnswers[key] = data.answers[key];
          }
        });
        
        console.log("Yopiq javoblar soni:", Object.keys(closedAnswers).length);
        console.log("Ochiq javoblar soni:", Object.keys(openAnswers).length);
        console.log("Ochiq javoblar:", openAnswers);
        
        // Saqlash uchun ma'lumotlar
        const saveData = {
          id: `${userId}_${Date.now()}`,
          userId: userId,
          userName: data.userName || "Foydalanuvchi",
          timestamp: timestamp,
          testInfo: {
            closedQuestions: numClosed,
            openQuestions: numOpen,
            totalQuestions: numClosed + numOpen
          },
          answers: data.answers,
          closedAnswers: closedAnswers,
          openAnswers: openAnswers,
          openAnswersCount: Object.keys(openAnswers).length,
          closedAnswersCount: Object.keys(closedAnswers).length,
          totalAnswers: Object.keys(data.answers).length
        };
        
        // 1. Asosiy ma'lumotni KV ga saqlash
        const uniqueKey = `answer_${userId}_${Date.now()}`;
        await env.DATA.put(uniqueKey, JSON.stringify(saveData));
        
        // 2. Foydalanuvchi uchun indeks saqlash
        const userIndexKey = `user_${userId}_index`;
        let userIndex = [];
        
        try {
          const existingIndex = await env.DATA.get(userIndexKey, 'json');
          if (existingIndex && Array.isArray(existingIndex)) {
            userIndex = existingIndex;
          }
        } catch (e) {
          console.log("Yangi index yaratildi");
        }
        
        userIndex.push({
          key: uniqueKey,
          timestamp: timestamp,
          totalAnswers: saveData.totalAnswers
        });
        
        // Faqat oxirgi 50 ta saqlash
        if (userIndex.length > 50) {
          userIndex = userIndex.slice(-50);
        }
        
        await env.DATA.put(userIndexKey, JSON.stringify(userIndex));
        
        // 3. Ochiq javoblarni alohida saqlash (agar mavjud bo'lsa)
        if (Object.keys(openAnswers).length > 0) {
          const openAnswersKey = `open_${uniqueKey}`;
          await env.DATA.put(openAnswersKey, JSON.stringify({
            openAnswers: openAnswers,
            timestamp: timestamp,
            userId: userId
          }));
          console.log("Ochiq javoblar alohida saqlandi:", openAnswersKey);
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: "Javoblar muvaffaqiyatli saqlandi",
          savedId: uniqueKey,
          stats: {
            total: saveData.totalAnswers,
            closed: saveData.closedAnswersCount,
            open: saveData.openAnswersCount,
            openAnswers: openAnswers // Tekshirish uchun qaytarish
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
      const action = url.searchParams.get('action');
      
      if (action === 'test') {
        // Test endpoint
        return new Response(JSON.stringify({
          success: true,
          message: "Worker ishlamoqda",
          timestamp: new Date().toISOString(),
          kv: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (userId) {
        // Foydalanuvchi ma'lumotlarini olish
        const userIndexKey = `user_${userId}_index`;
        
        try {
          const userIndex = await env.DATA.get(userIndexKey, 'json');
          const results = [];
          
          if (userIndex && Array.isArray(userIndex)) {
            // Eng so'nggi 10 tasini olish
            const recentKeys = userIndex.slice(-10).map(item => item.key);
            
            // Har bir kalitdan ma'lumotlarni olish
            for (const key of recentKeys) {
              const data = await env.DATA.get(key, 'json');
              if (data) {
                results.push({
                  key: key,
                  timestamp: data.timestamp,
                  total: data.totalAnswers,
                  closed: data.closedAnswersCount,
                  open: data.openAnswersCount,
                  openAnswers: data.openAnswers || {}
                });
              }
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            userId: userId,
            results: results,
            count: results.length
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Barcha ma'lumotlarni ko'rish (faqat admin)
      if (url.searchParams.get('admin') === 'true') {
        const list = await env.DATA.list();
        const keys = list.keys.map(k => k.name);
        
        return new Response(JSON.stringify({
          success: true,
          total: keys.length,
          keys: keys.slice(0, 100) // Faqat birinchi 100 tasi
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: "userId kerak yoki action noto'g'ri"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: "Noto'g'ri so'rov"
    }), {
      status: 404,
      headers: corsHeaders
    });
  }
};
