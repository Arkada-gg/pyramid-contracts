# Arkada smart contracts repository

## The structure of the repository

- [.openzeppelin/](./.openzeppelin/) - contains files related to openzeppelin proxy deployment (such as deployment addresses, storage layout, etc. ).
- [config/](./config/) - contains application static configuration (like network configs, TS types etc.).
- [contracts/](./contracts/) - root folder for smart contracts source code.
- [deployments/](./deployments/) - *deprecated*. hardhat-deploy deployment folder.
- [docgen/](./docgen/) - contains auto generated smart-contracts documentation.
- [helpers/](./helpers/) - shared helpers utilities.
- [scripts/](./scripts/) - hardhat scripts. Currently contains deploy/upgrade scripts for smart contracts.
- [tasks/](./tasks/) - hardhat tasks. Currently contains calldata generator scripts.
- [test/](./test/) - smart contracts tests.

## How to run?

First, install the dependencies using `yarn`

```
yarn install
```

To build smart contracts, execute

```
yarn build
```

To run tests, execute

```
yarn test
```

To run test`s coverage, execute

```
yarn coverage
```

To use Slither analyzer, first install it. [Link](https://github.com/crytic/slither)

To run the analyzer, execute

```
yarn slither
```


To generate smart contract`s documentation, execute

```
yarn docgen
```

## Smart contracts API documentation

All smart contracts are documented using NatSpec format. To review the latest generated documentation, please check the [docgen/index.md](./docgen/index.md) file.