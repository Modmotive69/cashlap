
import { useState, useEffect, useCallback } from 'react';
import { User, Notification } from '@/entities/all';
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
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const fetchedNotifications = await Notification.filter(
        { user_id: user.id }, 
        '-created_date', 
        20
      );
      setNotifications(fetchedNotifications);
      const unread = fetchedNotifications.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const fetchUserAndNotifications = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to fetch user or unread count:', error);
        setLoading(false);
      }
    };
    fetchUserAndNotifications();
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll more frequently for a "live" feel
      const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  const markAsRead = async (notificationId) => {
    // Only proceed if the notification is currently unread
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.is_read) return;

    try {
      await Notification.update(notificationId, { is_read: true });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) return;

      // In a real SDK, you might have a bulk update. Simulating it here.
      await Promise.all(unreadIds.map(id => Notification.update(id, { is_read: true })));
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
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
