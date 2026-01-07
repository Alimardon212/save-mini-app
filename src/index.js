export default {
  async fetch(request, env, ctx) {
    // Keng CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'false'
    };

    // OPTIONS request (preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health' || url.searchParams.get('health')) {
      return new Response(JSON.stringify({
        status: "online",
        timestamp: new Date().toISOString(),
        worker: "miniapp-api",
        version: "1.0.0",
        cors: "enabled"
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // POST request - save answers
    if (request.method === 'POST') {
      try {
        let data;
        try {
          data = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({
            success: false,
            error: "Invalid JSON in request body"
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        // Validate required fields
        if (!data.userId) {
          return new Response(JSON.stringify({
            success: false,
            error: "userId is required"
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        const userId = data.userId.toString();
        const timestamp = data.timestamp || new Date().toISOString();
        
        // Process answers
        const numClosed = data.testInfo?.closedQuestions || 30;
        const closedAnswers = {};
        const openAnswers = {};
        
        if (data.answers && typeof data.answers === 'object') {
          Object.keys(data.answers).forEach(key => {
            const qNum = parseInt(key);
            if (!isNaN(qNum)) {
              if (qNum <= numClosed) {
                closedAnswers[key] = data.answers[key];
              } else {
                openAnswers[key] = data.answers[key];
              }
            }
          });
        }
        
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
          answers: data.answers || {},
          closedAnswers: closedAnswers,
          openAnswers: openAnswers,
          closedCount: Object.keys(closedAnswers).length,
          openCount: Object.keys(openAnswers).length,
          totalCount: Object.keys(data.answers || {}).length
        };

        console.log(`Saving data for user ${userId}:`, {
          closed: saveData.closedCount,
          open: saveData.openCount,
          total: saveData.totalCount
        });

        // Save to KV
        const kvKey = `answer_${userId}_${Date.now()}`;
        try {
          await env.DATA.put(kvKey, JSON.stringify(saveData));
          console.log(`Data saved to KV with key: ${kvKey}`);
        } catch (kvError) {
          console.error("KV save error:", kvError);
          return new Response(JSON.stringify({
            success: false,
            error: "Failed to save to database"
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Test answers saved successfully",
          savedId: kvKey,
          stats: {
            total: saveData.totalCount,
            closed: saveData.closedCount,
            open: saveData.openCount,
            openAnswers: openAnswers
          },
          debug: {
            userId: userId,
            timestamp: timestamp
          }
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });

      } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(JSON.stringify({
          success: false,
          error: "Internal server error",
          message: error.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // GET request
    if (request.method === 'GET') {
      const userId = url.searchParams.get('userId');
      
      if (userId) {
        try {
          const userIndexKey = `user_index_${userId}`;
          const userIndex = await env.DATA.get(userIndexKey, 'json') || [];
          
          return new Response(JSON.stringify({
            success: true,
            userId: userId,
            submissions: userIndex.length,
            recent: userIndex.slice(-5)
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      
      // Default response
      return new Response(JSON.stringify({
        service: "MiniApp Test API",
        endpoints: {
          "POST /": "Submit test answers",
          "GET /health": "Health check",
          "GET /?userId=ID": "Get user submissions"
        },
        cors: "enabled"
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
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
