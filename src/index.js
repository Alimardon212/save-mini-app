export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // POST request - save answers
    if (request.method === 'POST') {
      try {
        const data = await request.json();
        console.log("POST request received");
        
        // Validate data
        if (!data.userId || !data.answers) {
          return new Response(JSON.stringify({
            success: false,
            error: "userId and answers are required"
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const userId = data.userId.toString();
        const timestamp = data.timestamp || new Date().toISOString();
        
        // Separate open and closed answers
        const numClosed = data.testInfo?.closedQuestions || 30;
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
        
        // Prepare data for storage
        const saveData = {
          id: `${userId}_${Date.now()}`,
          userId: userId,
          userName: data.userName || "User",
          timestamp: timestamp,
          testInfo: data.testInfo || {
            closedQuestions: 30,
            openQuestions: 5,
            totalQuestions: 35
          },
          answers: data.answers,
          closedAnswers: closedAnswers,
          openAnswers: openAnswers,
          closedCount: Object.keys(closedAnswers).length,
          openCount: Object.keys(openAnswers).length,
          totalCount: Object.keys(data.answers).length
        };

        console.log(`Saving data for user ${userId}:`, {
          closed: saveData.closedCount,
          open: saveData.openCount,
          total: saveData.totalCount
        });

        // Save to KV
        const kvKey = `test_${userId}_${Date.now()}`;
        await env.DATA.put(kvKey, JSON.stringify(saveData));
        
        // Update user index
        const userIndexKey = `index_${userId}`;
        let userIndex = [];
        
        try {
          const existing = await env.DATA.get(userIndexKey, 'json');
          if (existing && Array.isArray(existing)) {
            userIndex = existing;
          }
        } catch (e) {
          // New user
        }
        
        userIndex.push({
          key: kvKey,
          timestamp: timestamp,
          total: saveData.totalCount,
          open: saveData.openCount
        });
        
        // Keep only last 20 entries
        if (userIndex.length > 20) {
          userIndex = userIndex.slice(-20);
        }
        
        await env.DATA.put(userIndexKey, JSON.stringify(userIndex));

        return new Response(JSON.stringify({
          success: true,
          message: "Answers saved successfully",
          savedId: kvKey,
          stats: {
            total: saveData.totalCount,
            closed: saveData.closedCount,
            open: saveData.openCount,
            openAnswers: openAnswers
          },
          debug: {
            kvKey: kvKey,
            timestamp: timestamp
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error("Error:", error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          details: "Internal server error"
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET request - retrieve data
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Health check
      if (path === '/health' || url.searchParams.get('health') === 'true') {
        return new Response(JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          worker: "miniapp-api",
          kv: "connected"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Get user data
      const userId = url.searchParams.get('userId');
      if (userId) {
        try {
          const userIndexKey = `index_${userId}`;
          const userIndex = await env.DATA.get(userIndexKey, 'json') || [];
          
          // Get detailed data for each entry
          const detailedResults = [];
          for (const entry of userIndex.slice(-10)) {
            const data = await env.DATA.get(entry.key, 'json');
            if (data) {
              detailedResults.push({
                timestamp: data.timestamp,
                total: data.totalCount,
                closed: data.closedCount,
                open: data.openCount,
                openAnswers: data.openAnswers || {}
              });
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            userId: userId,
            totalEntries: userIndex.length,
            recent: detailedResults
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
      
      // List all KV keys (admin only)
      if (url.searchParams.get('admin') === 'true') {
        const list = await env.DATA.list();
        return new Response(JSON.stringify({
          success: true,
          totalKeys: list.keys.length,
          keys: list.keys.map(k => k.name).slice(0, 50)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Default response
      return new Response(JSON.stringify({
        message: "MiniApp API",
        endpoints: {
          POST: "/ - Save test answers",
          GET: "/?userId=123 - Get user answers",
          GET: "/health - Health check"
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method not allowed
    return new Response(JSON.stringify({
      success: false,
      error: "Method not allowed"
    }), {
      status: 405,
      headers: corsHeaders
    });
  }
};
