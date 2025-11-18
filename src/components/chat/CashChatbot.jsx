
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InvokeLLM } from '@/integrations/Core';
import { User } from '@/entities/User';
import {
  X,
  Send,
  Loader2,
  Minimize2,
  Maximize2,
  PanelRightClose
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';

const CASHIE_SYSTEM_PROMPT = `You are Cashie, the friendly and helpful mascot of CashLap! You're a cute green cube character who loves helping users navigate the platform.

About CashLap:
- CashLap is a platform that connects local businesses with customers through engaging campaigns
- Players complete missions (like visiting businesses, taking photos, posting on social media) to earn rewards
- Businesses create campaigns to attract customers and increase visibility
- Users can switch between Player and Business account types
- Players earn money by completing missions and can track their progress through levels
- Businesses can create campaigns, set rewards, and track analytics

Your personality:
- Friendly, enthusiastic, and helpful
- Use a casual, conversational tone
- Occasionally use simple emojis (especially 💚 for green/money themes)
- Keep responses concise but informative
- Always try to guide users to the right features or pages

Common topics you help with:
- How to complete missions
- Creating campaigns for businesses
- Understanding rewards and earnings
- Navigating between different sections
- Account settings and profile management
- Troubleshooting basic issues
- Explaining CashLap features

Always stay in character as Cashie and keep the CashLap branding positive and engaging!`;

export default function CashChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed
  const [isDragging, setIsDragging] = useState(false); // New state to track dragging
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'cash',
      text: "Hey there! I'm Cashie, your friendly CashLap assistant! 💚 How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);

  // Ref for the draggable button to calculate its dimensions for drag constraints
  const collapsedButtonRef = useRef(null);

  // Use a motion value to track and control the Y position
  const y = useMotionValue(0);

  useEffect(() => {
    loadUser();

    // On initial load, check for a saved position in local storage
    const savedY = localStorage.getItem('cashie_position_y');
    if (savedY !== null) {
      y.set(parseFloat(savedY));
    } else {
      // If no position is saved, center it by default
      // This useEffect runs after the first render, so collapsedButtonRef.current should be set.
      // The button has 'top-1/2' class, so its top edge is at 50% viewport height.
      // To center the button, we translate it up by half its height.
      const buttonHeight = collapsedButtonRef.current?.offsetHeight || 64; // Use default height as fallback
      y.set(-(buttonHeight / 2));
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not authenticated - guest mode");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: inputText.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const contextInfo = user ? `
Current user info:
- Account type: ${user.account_type}
- Name: ${user.full_name || 'User'}
- Total earnings: $${user.total_earnings || 0}
- Level: ${user.level || 1}
- Missions completed: ${user.missions_completed || 0}
` : 'User is not logged in (guest mode)';

      const response = await InvokeLLM({
        prompt: `${CASHIE_SYSTEM_PROMPT}

${contextInfo}

User question: "${userMessage.text}"

Respond as Cashie in a helpful, friendly way. Keep it concise (2-3 sentences max unless explaining something complex).`
      });

      const cashMessage = {
        id: Date.now() + 1,
        sender: 'cash',
        text: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, cashMessage]);
    } catch (error) {
      console.error('Error getting Cashie response:', error);
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'cash',
        text: "Oops! I'm having a little trouble right now. Try asking me again in a moment! 💚",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    // If opening chat, ensure it's not collapsed or minimized
    if (!isOpen) {
      setIsCollapsed(false);
      setIsMinimized(false);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleCollapse = () => {
    setIsOpen(false);
    setIsCollapsed(true);
    setIsMinimized(false); // Reset minimize state when collapsing
  };

  const handleExpand = () => {
    if (!isDragging) { // Only expand if not currently dragging
      setIsCollapsed(false);
      setIsOpen(true);
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    // Save the final Y position to local storage
    localStorage.setItem('cashie_position_y', y.get());
    // Add a small delay to ensure drag state is maintained through the tap event
    // or to allow the browser to register the end of the drag before a potential click/tap event fires.
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
  };

  return (
    <>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[9999] w-80 sm:w-96"
          >
            <Card className="shadow-2xl border-2 border-[var(--cashlap-green)]/20">
              <CardHeader className="p-3 bg-[var(--cashlap-green)] text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/8a050254a_20250612_0908_TranslucentGreenCube_remix_01jxj7f9waej1th5v95nhpaa9t.png"
                      alt="Cashie"
                      className="w-8 h-8 object-contain"
                    />
                    <div>
                      <CardTitle className="text-sm font-bold">Cashie</CardTitle>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-100">Online</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCollapse}
                      className="w-6 h-6 text-white hover:bg-white/20"
                    >
                      <PanelRightClose className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMinimize}
                      className="w-6 h-6 text-white hover:bg-white/20"
                    >
                      {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleChat}
                      className="w-6 h-6 text-white hover:bg-white/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {!isMinimized && (
                <CardContent className="p-0">
                  {/* Messages Area */}
                  <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex items-start gap-2 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          {message.sender === 'cash' && (
                            <img
                              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/8a050254a_20250612_0908_TranslucentGreenCube_remix_01jxj7f9waej1th5v95nhpaa9t.png"
                              alt="Cashie"
                              className="w-6 h-6 object-contain flex-shrink-0 mt-1"
                            />
                          )}
                          <div
                            className={`px-3 py-2 rounded-lg text-sm ${
                              message.sender === 'user'
                                ? 'bg-[var(--cashlap-blue)] text-white'
                                : 'bg-white text-gray-800 border'
                            }`}
                          >
                            {message.text}
                          </div>
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="flex items-start gap-2">
                          <img
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/8a050254a_20250612_0908_TranslucentGreenCube_remix_01jxj7f9waej1th5v95nhpaa9t.png"
                            alt="Cashie"
                            className="w-6 h-6 object-contain flex-shrink-0 mt-1"
                          />
                          <div className="bg-white border px-3 py-2 rounded-lg flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[var(--cashlap-green)]" />
                            <span className="text-sm text-gray-600">Cashie is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t bg-white">
                    <div className="flex gap-2">
                      <Input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask Cashie anything about CashLap..."
                        className="flex-1"
                        disabled={isLoading}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!inputText.trim() || isLoading}
                        className="bg-[var(--cashlap-green)] hover:bg-[var(--cashlap-green)]/90"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Cashie is here to help with CashLap questions! 💚
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Collapsed Tab on Right Side - Draggable and Persistent */}
      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            ref={collapsedButtonRef} // Attach ref here for dimension calculations
            drag="y"
            dragMomentum={false}
            className="fixed top-1/2 right-0 z-[9999] cursor-grab active:cursor-grabbing"
            style={{ y }} // Bind the motion value to the style
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onDragStart={handleDragStart} // Start tracking drag
            onDragEnd={handleDragEnd}     // Stop tracking drag and save position
            onTap={handleExpand}          // Use onTap to differentiate between tap and drag
          >
            <div onPointerDown={(e) => e.stopPropagation()}>
              <Button
                className="w-14 h-16 rounded-l-xl rounded-r-none bg-[var(--cashlap-green)] hover:bg-[var(--cashlap-green)]/90 shadow-lg p-0 flex items-center justify-center"
                style={{ cursor: 'pointer' }}
                tabIndex="-1" // Remove from tab order as the parent motion.div handles interaction
              >
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/8a050254a_20250612_0908_TranslucentGreenCube_remix_01jxj7f9waej1th5v95nhpaa9t.png"
                  alt="Cashie"
                  className="w-9 h-9 object-contain pointer-events-none" // Prevent image from interfering with drag
                />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
