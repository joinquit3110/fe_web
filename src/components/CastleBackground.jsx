import React from 'react';
import '../styles/Castle.css';

const CastleBackground = () => {
  return (
    <div className="castle-background">
      <div className="castle">
        <div id="front">
          <div className="first">
            <div className="castleRoof"></div>
            <div className="secondcolumn">
              <div className="bevel bl middle br">
                <div className="door1"></div>
                <div className="door2"></div>
                <div className="door3"></div>
                <div className="door4"></div>
                <div className="door5"></div>
              </div>
            </div>
            <div className="firstcolumn"></div>
          </div>
        </div>
        <div id="middle">
          <div className="first">
            <div className="baseRoof"></div>
            <div className="secondcolumn">
              <div className="bevel bl middle br">
                <div className="door1"></div>
                <div className="door2"></div>
                <div className="door3"></div>
                <div className="door4"></div>
                <div className="door5"></div>
              </div>
            </div>
            <div className="firstcolumn"></div>
          </div>
        </div>
        <div id="Last">
          <div className="first">
            <div className="castleRoof"></div>
            <div className="secondcolumn">
              <div className="bevel bl middle br">
                <div className="door1"></div>
                <div className="door2"></div>
                <div className="door3"></div>
                <div className="door4"></div>
                <div className="door5"></div>
              </div>
            </div>
            <div className="firstcolumn"></div>
          </div>
        </div>
        <div className="ground"></div>
      </div>
    </div>
  );
};

export default CastleBackground; 