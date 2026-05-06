import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Notification } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { markNotificationsRead } from '@/functions/markNotificationsRead';
import { Button } from '@/components/ui/button';
import {
  Bell,
  Archive,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const userIdRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const fetchedNotifications = await Notification.filter(
        { user_id: userId }, 
        '-created_date', 
        20
      );
      setNotifications(fetchedNotifications);
      setUnreadCount(fetchedNotifications.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = null;

    const init = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        userIdRef.current = currentUser.id;
        await fetchNotifications(currentUser.id);

        // Real-time subscription — fires instantly when a notification is created/updated/deleted
        unsubscribe = base44.entities.Notification.subscribe((event) => {
          if (event.data?.user_id !== currentUser.id) return;

          if (event.type === 'create') {
            setNotifications(prev => [event.data, ...prev].slice(0, 20));
            if (!event.data.is_read) setUnreadCount(prev => prev + 1);
          } else if (event.type === 'update') {
            setNotifications(prev =>
              prev.map(n => n.id === event.id ? event.data : n)
            );
            // Recalculate unread count from latest state
            setNotifications(prev => {
              setUnreadCount(prev.filter(n => !n.is_read).length);
              return prev;
            });
          } else if (event.type === 'delete') {
            setNotifications(prev => {
              const updated = prev.filter(n => n.id !== event.id);
              setUnreadCount(updated.filter(n => !n.is_read).length);
              return updated;
            });
          }
        });
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
        setLoading(false);
      }
    };

    init();

    // Fallback poll every 15 seconds in case websocket drops
    const interval = setInterval(() => {
      if (userIdRef.current) fetchNotifications(userIdRef.current);
    }, 15000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markAsRead = async (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.is_read) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await markNotificationsRead({ notificationIds: [notificationId] });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markNotificationsRead({ notificationIds: unreadIds });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    if (notification.link_url) {
      navigate(notification.link_url);
    }
  };

  if (!user) {
    // Don't render the bell if there's no logged-in user
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notifications</span>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <Archive className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="flex justify-center items-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-sm text-gray-500 p-4">
            You have no new notifications.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${!notification.is_read ? 'bg-blue-50' : ''}`}
                onClick={() => handleNotificationClick(notification)}
                asChild
              >
                <div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{notification.title}</p>
                    <p className="text-xs text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}