import "./App.css";
import { useEffect, useState, useCallback } from "react";
import io from "socket.io-client";
import axios from 'axios';
import UserSelect from './components/UserSelect';

const socket = io.connect("http://localhost:4000", {
    transports: ['websocket'],
    debug: true
});

function App() {
  const [message, setMessage] = useState("");
  const [messageReceived, setMessageReceived] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  // 1. First, verify socket connection
  useEffect(() => {
    console.log('Setting up socket connection');
    
    socket.on('connect', () => {
      console.log('Socket connected!', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // 2. Set up notification listeners AFTER connection
    console.log('Setting up notification listeners');
    
    socket.on("new_notification", (notification) => {
      console.log('🔔 Received real-time notification:', notification);
      setNotifications(prev => {
        const exists = prev.some(n => n._id === notification._id);
        if (exists) {
          console.log('Notification already exists, skipping');
          return prev;
        }
        console.log('Adding new notification to list');
        return [notification, ...prev];
      });
    });

    socket.on("notification_updated", (updatedNotification) => {
      console.log('🔄 Received notification update:', updatedNotification);
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === updatedNotification._id ? updatedNotification : notif
        )
      );
    });

    // Cleanup all listeners
    return () => {
      console.log('Cleaning up socket listeners');
      socket.off('connect');
      socket.off('connect_error');
      socket.off("new_notification");
      socket.off("notification_updated");
    };
  }, []); // Empty dependency array - run once on mount

  // 3. Handle room management separately
  useEffect(() => {
    if (selectedUserId) {
      console.log(`Attempting to join room for user: ${selectedUserId}`);
      socket.emit("join_user_room", selectedUserId);
      fetchNotifications();
    }

    return () => {
      if (selectedUserId) {
        console.log(`Leaving room for user: ${selectedUserId}`);
        socket.emit("leave_user_room", selectedUserId);
      }
    };
  }, [selectedUserId]);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`http://localhost:4000/api/notifications/${selectedUserId}`);
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const sendMessage = () => {
    if (!selectedUserId) {
      alert('Please select a user first');
      return;
    }
    socket.emit("send_message", { message, userId: selectedUserId });
    setMessage("");
  };

  const sendNotification = async () => {
    if (!selectedUserId) {
      alert('Please select a user first');
      return;
    }
    try {
      const response = await axios.post('http://localhost:4000/api/notification', {
        message,
        userId: selectedUserId,
        status: 'unread'
      });
      setMessage('');
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      // Emit socket event for real-time update
      socket.emit("mark_notification_read", { notificationId });
      
      await axios.patch(`http://localhost:4000/api/notification/${notificationId}`, {
        status: 'read'
      });
      
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? {...n, status: 'read'} : n)
      );
    } catch (error) {
      console.error('Failed to update notification:', error);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Notification System</h1>
        <UserSelect onUserSelect={setSelectedUserId} selectedUserId={selectedUserId} />
      </header>

      <main className="main-content">
        <div className="message-section">
          <div className="input-group">
            <input
              value={message}
              placeholder="Type your message..."
              onChange={(e) => setMessage(e.target.value)}
              className="message-input"
              onKeyPress={(e) => e.key === 'Enter' && sendNotification()}
            />
            <div className="button-group">
              <button onClick={sendMessage} className="btn primary">Send Message</button>
              <button onClick={sendNotification} className="btn secondary">Send Notification</button>
            </div>
          </div>
          
          {messageReceived && (
            <div className="received-message">
              <h3>Received Message:</h3>
              <p>{messageReceived}</p>
            </div>
          )}
        </div>

        <div className="notifications-section">
          <h2>Notifications</h2>
          <div className="notifications-list">
            {notifications.map((notification) => (
              <div 
                key={notification._id} 
                className={`notification-card ${notification.status}`}
                onClick={() => notification.status === 'unread' && markAsRead(notification._id)}
              >
                <p className="notification-message">{notification.message}</p>
                <div className="notification-meta">
                  <span className="notification-time">
                    {new Date(notification.timestamp).toLocaleString()}
                  </span>
                  <span className={`status-badge ${notification.status}`}>
                    {notification.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;