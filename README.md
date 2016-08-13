# Promesse

[![Build Status](https://travis-ci.org/djfm/promesse.svg?branch=master)](https://travis-ci.org/djfm/promesse)

<a href="https://promisesaplus.com/">
    <img src="https://promisesaplus.com/assets/logo-small.png" alt="Promises/A+ logo"
         title="Promises/A+ 1.0 compliant" align="right" />
</a>

*Promesse* is a [Promises/A+](https://github.com/promises-aplus/promises-tests) compliant Promise library.

I've written it because I love promises in JS and I like to know how the tools I use work.
Besides, it's a nice exercise to work against an existing **huge** test suite.

## Installing

This is probably not very useful since promises are standard, but, if for some reason you need to:

```bash
npm i --save aplus-promesse
```

## Testing

```bash
git clone https://github.com/djfm/promesse
cd promesse
npm i
npm test
```

There are two test suites, the one from [Promises/A+](https://github.com/promises-aplus/promises-tests), and the one I wrote to help me when I did not understand the feedback from the official tests.
