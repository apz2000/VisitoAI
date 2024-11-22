import { useState, useEffect } from 'react';
import axios from 'axios';

function UserSelect({ onUserSelect, selectedUserId }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get('http://localhost:4000/api/users');
        setUsers(response.data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="user-select">
      <select 
        value={selectedUserId || ''} 
        onChange={(e) => onUserSelect(e.target.value)}
        className="user-dropdown"
      >
        <option value="">Select a user</option>
        {users.map(user => (
          <option key={user._id} value={user._id}>
            {user.name} {user.lastName} ({user.email})
          </option>
        ))}
      </select>
    </div>
  );
}

export default UserSelect; 