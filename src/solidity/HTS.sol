// SPDX-License-Identifier: Apache-2.0
pragma solidity >0.6.12 <0.9.0;

import "./HederaTokenService.sol";
import "./HederaResponseCodes.sol";

contract HTS is HederaTokenService {
    function tokenAssociate(address sender, address tokenAddress) external {
        int256 response = HederaTokenService.associateToken(
            sender,
            tokenAddress
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Associate Failed");
        }
    }

    function tokenTransfer(
        address tokenId,
        address fromAccountId,
        address toAccountId,
        int64 tokenAmount
    ) external {
        int256 response = HederaTokenService.transferToken(
            tokenId,
            toAccountId,
            fromAccountId,
            tokenAmount
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Transfer Failed");
        }
    }

    function tokenDissociate(address sender, address tokenAddress) external {
        int256 response = HederaTokenService.dissociateToken(
            sender,
            tokenAddress
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Dissociate Failed");
        }
    }

    function nftTransfer(
        address token,
        address sender,
        address receiver,
        int64 serialNumber
    ) external {
        int256 response = HederaTokenService.transferNFT(
            token,
            sender,
            receiver,
            serialNumber
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("NFT Transfer Failed");
        }
    }
}
