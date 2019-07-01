[//]: # (Readme partial used by an default readme page)

## Main features

*   tiny & easy to use: only 3 methods
*   delayed dependency initialisation
*   No dependencies (for dist)
*   Typescript types included
*   exposes esm/cjs modules
*   always 100% test coverage

## Guide

*   [Installation](#installation "Installation")
*   [Basic usage](#basicusage "Basic usage")
*   [Advanced usage](#advancedusage "Advanced usage")
*   [API documentation](#documentation "Documentation")

## Installation

<pre>npm install --save jetli</pre>

or

<pre>yarn add jetli</pre>

or

<pre>pnpm --save jetli</pre>

## Basic usage

Jetli allows you to inject consistently classes, functions and primitives across whole application.

### Inject & instantiate class via 'get' method

Injecting instances of classes is trivial with jetli - just use 'get' method without any additional options.

<pre class="runkit-source">const jetli = require('jetli@3.0.1').jetli;

class Attack {
    constructor(){
        this.id = Math.round(Math.random() * 100);
        console.log(`Attack no. ${this.id} ready!`);
    }
    punch(){
        console.log(`Attack no. ${this.id} executed!`);
    }
}

const fighter1 = await jetli.get(Attack);
const fighter2 = await jetli.get(Attack);

fighter1.punch();
fighter2.punch();</pre>

### Inject & instantiate class via 'set' and retrieve instance via 'get' methods

Functions, already instantiated objects or primitive values like array, string and numbers can be injected via 'get' method priory to registering them with jetli. 

Registration is provided via 'set' method and requires you to provide string token that identifies the injectable element.

<pre class="runkit-source">const jetli = require('jetli@3.0.1').jetli;

class Attack {
    constructor(){
        this.id = Math.round(Math.random() * 100);
        console.log(`Attack no. ${this.id} ready!`);
    }
    punch(){
        console.log(`Attack no. ${this.id} executed!`);
    }
}
await jetli.set('attack', Attack);

const fighter1 = await jetli.get('attack');
const fighter2 = await jetli.get('attack');

fighter1.punch();
fighter2.punch();</pre>

### Inject primitives via id

As explained in previous example primitives can be easily used across your applications with associated string id provided during registration.

<pre class="runkit-source">const jetli = require('jetli@3.0.1').jetli;

const someNumber = 123;
const someString = 'punch';
const someArray = [123, 'punch'];

await jetli.set('number', someNumber);
await jetli.set('string', someString);
await jetli.set('array', someArray);

const injectedNumber = await jetli.get('number');
console.log(injectedNumber);

const injectedString = await jetli.get('string');
console.log(injectedString);

const injectedArray = await jetli.get('array');
console.log(injectedArray);</pre>

### Create initialisation-friendly services

To use Jetli to full extend implement services that expose init method. This method is the safest place to use Jelit injector inside injectable services.

If you already initialised injectable and dont want jetli to call "init" make sure to set "initialise" property to true;

<pre class="runkit-source">const jetli = require('jetli@3.0.1').jetli;

await jetli.set('someNumber', 123);

class JetliFriendlyService {
    constructor(){
        this.initialised = false;
    }
    
    async init(jetli){
        this.id = await jetli.get('someNumber');
        console.log(`Attack no. ${this.id} ready!`);
        return Promise.resolve();
    }

    punch(){
        console.log(`Attack no. ${this.id} executed!`);
    }
}

const fighter1 = await jetli.get(JetliFriendlyService);
const fighter2 = await jetli.get(JetliFriendlyService);

fighter1.punch();
fighter2.punch();</pre>

## Advanced usage

### Delay initialisation of services until used (on injection request)

Have enough of overhead when all those services initialises at once? Register them and request initialisation only when injection is requested.

<pre class="runkit-source">const jetli = require('jetli@3.0.1').jetli;

class Attack {
    constructor(){
        this.id = Math.round(Math.random() * 100);
        console.log(`Attack no. ${this.id} ready!`);
    }
    punch(){
        console.log(`Attack no. ${this.id} executed!`);
    }
}

await jetli.set('attack', Attack, true);
console.log('No initialisation at this point');

const fighter1 = await jetli.get('attack');
const fighter2 = await jetli.get('attack');

fighter1.punch();
fighter2.punch();</pre>

### Pass arguments to services constructor

<pre class="runkit-source">const jetli = require('jetli@3.0.1').jetli;

class Attack {
    constructor(id){
        this.id = id;
        console.log(`Attack no. ${this.id} ready!`);
    }
    punch(){
        console.log(`Attack no. ${this.id} executed!`);
    }
}
const externalId = Math.round(Math.random() * 100);
await jetli.set('attack', Attack, false, externalId);

const fighter1 = await jetli.get('attack');
const fighter2 = await jetli.get('attack');

fighter1.punch();
fighter2.punch();</pre>

### Inject services into other services without circular dependency

Jetli uses battle-tested method to fight 'cyclic dependencies' - optional initialisation callback. Injector searches for optional "init" method to call it and as an argument to provide instance of injector itself. This method provide safe moment to inject all dependencies required by service - you can be sure that all dependencies will be already initialised.

<pre class="runkit-source">const jetli = require('jetli@3.0.1').jetli;

class ServiceA {
    constructor(){
        this.initialised = false;
    }
    
    async init(jetli){
        this.service = await jetli.get(ServiceB);
        this.id = this.service.getNumber();
        return Promise.resolve();
    }

    getNumber(){
        return 123;
    }

    getId(){
        return this.id;
    }
}

class ServiceB {
    constructor(){
        this.initialised = false;
    }
    
    async init(jetli){
        this.service = await jetli.get(ServiceA);
        this.id = this.service.getNumber();
        return Promise.resolve();
    }

    getNumber(){
        return 456;
    }

    getId(){
        return this.id;
    }
}

const serviceA = await jetli.get(ServiceA);
const serviceB = await jetli.get(ServiceB);

console.log(serviceA.getId());
console.log(serviceB.getId());</pre>

### Mock services for test purposes

Its rather trivial to mock module dependencies if you have total control whats injected where, right? ith Jetli you can reset any previously registered/injected dependencies and introduce your own mocks / stubs.

<pre class="runkit-source">const jetli = require('jetli@3.0.1').jetli;

class Attack {
    constructor(){
        this.id = Math.round(Math.random() * 100);
        console.log(`Attack no. ${this.id} ready!`);
    }
    punch(){
        console.log(`Attack no. ${this.id} executed!`);
    }
}

class AttackMock {
    constructor(){
        console.log(`Attack mocked!`);
    }
    punch(){
        console.log(`Mocked attack execution!`);
    }
}

// somewhere in your code
await jetli.set('attack', Attack);

const fighter1 = await jetli.get('attack');
fighter1.punch();

// somewhere in your test
jetli.unset('attack');
await jetli.set('attack', AttackMock);

const fighter2 = await jetli.get('attack');
fighter2.punch();</pre>
