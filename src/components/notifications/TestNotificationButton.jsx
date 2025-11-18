import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { testNotification } from '@/functions/testNotification';
import { Loader2, TestTube } from 'lucide-react';

export default function TestNotificationButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await testNotification();
      setResult(response.data);
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-blue-50">
      <h3 className="font-semibold mb-2">Notification System Test</h3>
      <Button 
        onClick={handleTest} 
        disabled={loading}
        className="mb-3"
        variant="outline"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <TestTube className="w-4 h-4 mr-2" />
            Create Test Notification
          </>
        )}
      </Button>
      
      {result && (
        <div className="mt-3 p-3 bg-white rounded border">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}