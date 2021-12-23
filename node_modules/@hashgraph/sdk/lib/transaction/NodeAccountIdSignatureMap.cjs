"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _cryptography = require("@hashgraph/cryptography");

var _ObjectMap = _interopRequireDefault(require("../ObjectMap.cjs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @augments {ObjectMap<PublicKey, Uint8Array>}
 */
class NodeAccountIdSignatureMap extends _ObjectMap.default {
  constructor() {
    super(s => _cryptography.PublicKey.fromString(s));
  }
  /**
   * @param {import("@hashgraph/proto").ISignatureMap} sigMap
   * @returns {NodeAccountIdSignatureMap}
   */


  static _fromTransactionSigMap(sigMap) {
    const signatures = new NodeAccountIdSignatureMap();
    const sigPairs = sigMap.sigPair != null ? sigMap.sigPair : [];

    for (const sigPair of sigPairs) {
      if (sigPair.pubKeyPrefix != null && sigPair.ed25519 != null) {
        signatures._set(_cryptography.PublicKey.fromBytes(sigPair.pubKeyPrefix), sigPair.ed25519);
      }
    }

    return signatures;
  }

}

exports.default = NodeAccountIdSignatureMap;