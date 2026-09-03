// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SparkToken
 * @notice A token launched on spark.fun. Fixed supply, minted once at
 *         construction to the deployer (the factory), which immediately moves
 *         it into the bonding curve. There is no mint function, no owner and no
 *         pause: after deployment nobody — creator or protocol — can change the
 *         supply or move anyone's balance.
 */
contract SparkToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    address public immutable creator;
    string public metadataURI;

    constructor(string memory name_, string memory symbol_, address creator_, string memory metadataURI_)
        ERC20(name_, symbol_)
    {
        creator = creator_;
        metadataURI = metadataURI_;
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
