# `@elizaos/plugin-btcfun`

This plugin provides actions and providers to interact with btcfun via bitcoin network.

---

## Configuration

### Default Setup

By default, **Bitcoin mainnet** is enabled. To use it, simply add your private key to the `.env` file:

```env
BTC_PRIVATE_KEY_WIF=your-private-key-here
ADDRESS=your-address-here
BTCFUN_API_URL=https://api-testnet-new.btc.fun
MINTCAP=10000
MINTDEADLINE=864000
ADDRESS_FUNDRAISING_CAP=100
