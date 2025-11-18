import { Button } from '@/components/ui/button';
import { Delete } from 'lucide-react';

export default function NumericKeypad({ onKeyPress }) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'], 
    ['7', '8', '9'],
    ['.', '0', 'del']
  ];

  const handleKeyPress = (key) => {
    onKeyPress(key);
  };

  return (
    <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
      {keys.flat().map((key) => (
        <Button
          key={key}
          variant="ghost"
          onClick={() => handleKeyPress(key)}
          className="h-14 text-xl font-light text-gray-800 rounded-lg transition-colors duration-150 ease-in-out bg-gray-100 hover:bg-gray-200 active:bg-gray-300 focus:ring-2 focus:ring-[var(--cashlap-green)]/50 touch-manipulation"
          style={{ 
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          {key === 'del' ? <Delete className="w-5 h-5 text-gray-600" /> : key}
        </Button>
      ))}
    </div>
  );
}