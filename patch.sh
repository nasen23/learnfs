#!/usr/bin/env bash

sed -i.bak "s/import \* as cheerio from 'cheerio';/import cheerio from 'cheerio';/" node_modules/thu-learn-lib/lib/index.js
sed -i.bak "s/import \* as FormData from 'form-data';/import FormData from 'form-data';/" node_modules/thu-learn-lib/lib/urls.js
