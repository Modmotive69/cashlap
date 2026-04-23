import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const user = await base44.auth.me();
    
    // Test 1: Create a direct notification for the current user
    try {
      const testNotification = await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        type: 'general',
        title: '🧪 Test Notification',
        message: 'This is a test notification to verify the system is working.',
        link_url: 'Dashboard',
        priority: 'high',
        is_read: false,
        metadata: { test: true, timestamp: new Date().toISOString() }
      });
      
      console.log(`Test notification created: ${testNotification.id} for user: ${user.id}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Test notification created successfully',
        notification: testNotification,
        user: {
          id: user.id,
          email: user.email,
          account_type: user.account_type,
          business_id: user.business_id
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (createError) {
      console.error('Failed to create test notification:', createError);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to create test notification',
        details: createError.message,
        user: {
          id: user.id,
          email: user.email,
          account_type: user.account_type,
          business_id: user.business_id
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Test notification function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Test function failed',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});