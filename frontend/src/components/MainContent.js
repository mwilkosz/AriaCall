import React, { useState, useCallback } from 'react';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import './MainContent.css';

function MainContent() {
  const [refreshCalendar, setRefreshCalendar] = useState(0);

  const handleRefreshCalendar = useCallback(() => {
    setRefreshCalendar((prev) => prev + 1);
  }, []);

  return (
    <div className="main-content">
      <LeftPanel onCallEnded={handleRefreshCalendar} />
      <RightPanel refreshCalendar={refreshCalendar} />
    </div>
  );
}

export default MainContent;
