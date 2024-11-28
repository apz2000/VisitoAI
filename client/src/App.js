import "./App.css";
import { useEffect, useState } from "react";
import io from "socket.io-client";
import UserSelect from './components/UserSelect';
// TODO: create notifications component

// TODO: fix socket connection when server restarts
const socket = io.connect("http://localhost:4000", {
    transports: ['websocket'],
    debug: true
});

function App() {
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  // 1. First, verify socket connection
  useEffect(() => {
    // console.log('Setting up socket connection');
    
    socket.on('connect', () => {
      // console.log('Socket connected!', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // 2. Set up notification listeners AFTER connection
    // console.log('Setting up notification listeners');
    
    socket.on("new_notification", (notification) => {
      // console.log('Received real-time notification:', notification);
      const id = notification.tempId || notification._id;
      setNotifications(prev => {
        const exists = prev.some(n => n._id === id);
        if (exists) {
          // console.log('Notification already exists, skipping');
          return prev;
        }
        notification._id = id;
        // console.log('Adding new notification to list', notification);
        return [notification, ...prev];
      });
    });

    socket.on("notification_updated", (updatedNotification) => {
      const tempId = updatedNotification.tempId;
      const dbId = updatedNotification._id;
      // console.log('Notification Update Received:', {
      //   tempId,
      //   dbId,
      //   fullUpdate: updatedNotification
      // });
      
      setNotifications(prev => 
        prev.map(notif => {
          if (notif._id.toString() === tempId?.toString() || notif._id === dbId) {
            return {
              ...notif,
              ...updatedNotification,
            };
          }
          return notif;
        })
      );
    });

    // Cleanup all listeners
    return () => {
      // console.log('Cleaning up socket listeners');
      socket.off('connect');
      socket.off('connect_error');
      socket.off("new_notification");
      socket.off("notification_updated");
    };
  }, []); // Empty dependency array - run once on mount

  // 3. Handle room management separately and populate notifications for selected user
  useEffect(() => {
    if (selectedUserId) {
      // console.log(`Attempting to join room for user: ${selectedUserId}`);
      socket.emit("join_user_room", selectedUserId);
      
      // Request initial notifications through socket
      socket.emit("get_initial_notifications", { userId: selectedUserId, channel: 'web' });
    }

    return () => {
      if (selectedUserId) {
        // console.log(`Leaving room for user: ${selectedUserId}`);
        socket.emit("leave_user_room", selectedUserId);
      }
    };
  }, [selectedUserId]);

  // Socket listeners for selected user in both initial load and real-time updates
  useEffect(() => {
    // console.log('Setting up notification listeners');
    
    // Handle initial notifications load
    socket.on("initial_notifications", (notifications) => {
      // console.log('Received initial notifications:', notifications);
      setNotifications(notifications);
    });

    // Handle real-time updates
    /*socket.on("new_notification", (notification) => {
      // console.log('Received real-time notification:', notification);
      setNotifications(prev => {
        const exists = prev.some(n => n._id === notification._id);
        if (exists) return prev;
        return [notification, ...prev];
      });
    });*/

    return () => {
      socket.off("initial_notifications");
      socket.off("new_notification");
    };
  }, []);

  // Send notification to selected user over HTTP instead of socket for testing purposes. They should only be sent via REST API.
  const sendNotification = async () => {
    if (!selectedUserId) {
      alert('Please select a user first');
      return;
    }
    try {
      /* const response = await axios.post('http://localhost:4000/api/notification', {
        message,
        userId: selectedUserId,
        status: 'unread'
      }); */
      
      socket.emit("send_notification", { message, userId: selectedUserId, status: 'unread' });
      setMessage('');
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  };

  const markAsReadOrUnread = async (notification) => {
    try {
      const status = notification.status === 'read' ? 'unread' : 'read';
      // Emit socket event for real-time update
      socket.emit("notification_change_status", { notificationId: notification._id, status });
      setNotifications(prev => 
        prev.map(n => n._id === notification._id ? {...n, status} : n)
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
              onKeyDown={(e) => e.key === 'Enter' && sendNotification()}
            />
            <div className="button-group">
              <button onClick={sendNotification} className="btn primary">Send Notification</button>
            </div>
          </div>
        </div>
        {/* TODO: create notifications component */}
        <div className="notifications-section">
          <h2>Notifications</h2>
          <div className="notifications-list">
            {notifications.map((notification) => (
              <div 
                key={notification._id} 
                className={`notification-card ${notification.status}`}
                onClick={() => markAsReadOrUnread(notification)}
              >
                <h3 className="notification-title">{notification.title}</h3>
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