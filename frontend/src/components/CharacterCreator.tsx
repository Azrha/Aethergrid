import React, { useState } from "react";

type CharacterCreatorProps = {
    onSpawn: (profile: any) => void;
    onClose: () => void;
};

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onSpawn, onClose }) => {
    const [name, setName] = useState("Traveler");
    const [role, setRole] = useState("settler");
    const [color, setColor] = useState("#ffbb99");

    const handleSpawn = () => {
        // Create a profile object compatible with the backend
        const profile = {
            name: name,
            count: 1,
            color: role,
            mass_range: [0.9, 1.2],
            hardness_range: [0.7, 1.2],
            speed_range: [-0.5, 0.5],
            depth_range: [0.2, 0.8],
            energy_range: [0.8, 1.2],
            wealth_range: [0.0, 0.4],
        };
        onSpawn(profile);
    };

    return (
        <div className="char-creator-overlay" style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000
        }}>
            <div className="card" style={{ width: "300px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3>Create Character</h3>

                <div>
                    <label>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        style={{ width: "100%", marginTop: "4px" }}
                    />
                </div>

                <div>
                    <label>Role</label>
                    <select
                        value={role}
                        onChange={e => setRole(e.target.value)}
                        style={{ width: "100%", marginTop: "4px", padding: "8px", background: "#333", color: "white", border: "none" }}
                    >
                        <option value="settler">Settler (Humanoid)</option>
                        <option value="fauna">Fauna (Animal)</option>
                        <option value="grove">Grove (Tree)</option>
                        <option value="habitat">Habitat (House)</option>
                    </select>
                </div>

                {/* Simple Visual Preview (Abstract) */}
                <div style={{
                    width: "100%", height: "100px",
                    background: "#222", display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "8px"
                }}>
                    <div style={{
                        width: "32px", height: "32px",
                        backgroundColor: role === 'settler' ? '#ffbb99' : role === 'fauna' ? '#66cc55' : '#888',
                        boxShadow: "0 0 20px rgba(255,255,255,0.2)"
                    }}></div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                    <button className="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                    <button onClick={handleSpawn} style={{ flex: 1 }}>Spawn</button>
                </div>
            </div>
        </div>
    );
};
