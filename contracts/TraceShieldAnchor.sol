// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TraceShieldAnchor
 * @notice Minimal EVM smart contract to anchor custody event SHA-256 cryptographic hashes on Base Sepolia.
 */
contract TraceShieldAnchor {
    // Mapping from 32-byte event hash to the block timestamp when anchored (0 if unanchored)
    mapping(bytes32 => uint256) public anchors;

    // Emitted when a custody event hash is anchored on-chain
    event EventAnchored(bytes32 indexed eventHash, uint256 timestamp);

    /**
     * @notice Anchors a 32-byte event hash on-chain.
     * @param eventHash The 32-byte SHA-256 hash of the canonical custody event.
     */
    function anchorEvent(bytes32 eventHash) external {
        require(eventHash != bytes32(0), "Empty hash");
        require(anchors[eventHash] == 0, "Already anchored");
        anchors[eventHash] = block.timestamp;
        emit EventAnchored(eventHash, block.timestamp);
    }

    /**
     * @notice Checks if an event hash has been anchored on-chain.
     * @param eventHash The 32-byte hash to query.
     * @return isAnchored True if anchored, false otherwise.
     * @return timestamp The block timestamp when anchored.
     */
    function getAnchor(bytes32 eventHash) external view returns (bool isAnchored, uint256 timestamp) {
        uint256 ts = anchors[eventHash];
        return (ts > 0, ts);
    }
}
