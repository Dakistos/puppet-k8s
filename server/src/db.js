const db = require('../models');
const express = require('express');

// DB testing
const main = async () => {
    const creator = await db.cookies.create({
        domain: 'https://varmatin.fr/',
        pageUrl: "test",
        requestUrl: "test",
        name: "varmatin"
    });

    const cookies = await db.cookies.findAll({})
    const all = JSON.stringify(cookies);
    console.log(all);
};

main();
