import React from 'react';
import { themeColors } from '../utils/inequalityAlgorithms';

const InequalityList = ({ 
  inequalities,
  onDelete,
  onHover,
  onShowRegionSelect
}) => {
  if (!inequalities || inequalities.length === 0) {
    return (
      <div className="inequality-list-empty">
        <div className="empty-message">
          <span className="material-icons">auto_fix_high</span>
          <p>Cast your first inequality spell to begin!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inequality-list">
      <div className="inequality-list-header">
        <div className="header-label">Inequality</div>
        <div className="header-actions">Actions</div>
      </div>
      <div className="inequality-list-items">
        {inequalities.map((inequality, index) => (
          <InequalityItem 
            key={inequality.label} 
            inequality={inequality}
            index={index}
            onDelete={onDelete}
            onHover={onHover}
            onShowRegionSelect={onShowRegionSelect}
          />
        ))}
      </div>
    </div>
  );
};

const InequalityItem = ({ 
  inequality, 
  index, 
  onDelete, 
  onHover,
  onShowRegionSelect
}) => {
  const handleMouseEnter = () => {
    onHover(inequality);
  };

  const handleMouseLeave = () => {
    onHover(null);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(inequality);
  };

  const handleShowRegionSelect = (e) => {
    e.stopPropagation();
    onShowRegionSelect(inequality.label);
  };

  // Determine if this is an equality or inequality
  const isEquality = inequality.operator === '=';
  const hasRegionSelected = !!inequality.solutionType;

  return (
    <div 
      className="inequality-item"
      style={{ 
        '--inequality-color': inequality.color,
        '--index': index,
        borderLeftColor: inequality.color
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="inequality-content">
        <div className="inequality-label">
          <span 
            className="inequality-label-text"
            dangerouslySetInnerHTML={{ 
              __html: `\\(${inequality.label}:\\;\\)` 
            }}
          />
        </div>
        <div 
          className="inequality-latex"
          dangerouslySetInnerHTML={{ 
            __html: `\\(${inequality.latex}\\)` 
          }}
        />
      </div>
      <div className="inequality-actions">
        {!isEquality && !hasRegionSelected && (
          <button 
            className="region-button"
            onClick={handleShowRegionSelect}
            title="Choose solution region"
          >
            <span className="material-icons">format_shapes</span>
          </button>
        )}
        <button 
          className="delete-button"
          onClick={handleDelete}
          title="Delete inequality"
        >
          <span className="material-icons">delete</span>
        </button>
      </div>
    </div>
  );
};

export default InequalityList; 