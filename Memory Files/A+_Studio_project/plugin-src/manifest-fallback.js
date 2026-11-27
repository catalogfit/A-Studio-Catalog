// ===== A+ Studio · bundled fallback (auto-generated from backend/templates) =====
// Used when the backend is unreachable, so the plugin always works offline.
// Manifest keys are "<category>/<gender>/<template>" and every "extends" is already resolved.
// Regenerate: node plugin-src/build-fallback.js
var FALLBACK_REGISTRY = {
  "schema": "aplus.registry/2",
  "updated": "2026-11-26",
  "sheet": {
    "comment": "Column layout of the live content sheet 'A+_Sheet_RUNNING_Template_1'. A Group · B Style IDs · C Category · D Subcategory · E Article Type · F Sub-family 2 · G First Card Headline · H First Card Subtext · I Fabric Subtext · J Composition · K Fabric Icons · L–O Feature 1–4 · P Last Slide Headline · Q Last Slide Body · R Status · S Flags · T Gender (to be added).",
    "styleIdColumn": 1,
    "categoryColumn": 2,
    "genderColumn": 19,
    "headlineColumn": 6,
    "taglineColumn": 7,
    "fabricCopyColumn": 8,
    "compositionColumn": 9,
    "iconsColumn": 10,
    "cardColumns": [
      11,
      12,
      13,
      14
    ],
    "statusColumn": 17,
    "cardTitleSeparator": ": ",
    "compositionSeparator": " | ",
    "headerRows": 1,
    "categoryAliases": {
      "run": "running",
      "running": "running",
      "train": "training",
      "training": "training",
      "lifestyle": "lifestyle",
      "comfort": "lifestyle",
      "seamless": "seamless",
      "flex": "seamless"
    },
    "genderAliases": {
      "m": "men",
      "men": "men",
      "mens": "men",
      "man": "men",
      "male": "men",
      "boys": "men",
      "w": "women",
      "women": "women",
      "womens": "women",
      "woman": "women",
      "female": "women",
      "ladies": "women",
      "girls": "women",
      "u": "unisex",
      "unisex": "unisex",
      "uni": "unisex",
      "all": "unisex"
    }
  },
  "categories": [
    {
      "id": "running",
      "label": "Running",
      "status": "active",
      "defaultGender": "men",
      "genders": [
        {
          "id": "men",
          "label": "Men",
          "status": "active",
          "hero": [
            "RUN",
            "UNSTOPPABLE"
          ],
          "templates": [
            {
              "id": "template-1",
              "label": "Standard",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 2,
              "status": "active",
              "file": "running/men/template-1.json"
            },
            {
              "id": "template-2",
              "label": "With fit comparison",
              "sub": "Standard + Regular vs Slim card",
              "features": [
                "fitComparison"
              ],
              "version": 2,
              "status": "active",
              "file": "running/men/template-2.json"
            }
          ]
        },
        {
          "id": "women",
          "label": "Women",
          "status": "active",
          "hero": [
            "RUN",
            "UNSTOPPABLE"
          ],
          "templates": [
            {
              "id": "template-1",
              "label": "Standard",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 2,
              "status": "active",
              "file": "running/women/template-1.json"
            },
            {
              "id": "template-2",
              "label": "With fit comparison",
              "sub": "Standard + Regular vs Slim card",
              "features": [
                "fitComparison"
              ],
              "version": 2,
              "status": "active",
              "file": "running/women/template-2.json"
            }
          ]
        }
      ]
    },
    {
      "id": "training",
      "label": "Training",
      "status": "active",
      "defaultGender": "men",
      "genders": [
        {
          "id": "men",
          "label": "Men",
          "status": "active",
          "hero": [
            "TRAIN",
            "FEARLESS"
          ],
          "comment": "One template: the three men's designs (707041/42/44, 707564/65/66, 707175/76/77) are structurally identical and differ only in a two-layer accent colour, which is art direction — see meta.artDirection in training/_base.json. Callout count comes from the sheet, not the template.",
          "templates": [
            {
              "id": "template-1",
              "label": "Standard",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 1,
              "status": "active",
              "file": "training/men/template-1.json"
            }
          ]
        },
        {
          "id": "women",
          "label": "Women",
          "status": "active",
          "hero": [
            "TRAIN",
            "FEARLESS"
          ],
          "comment": "Two templates: beyond the accent colour the two women's designs differ in close-up diameter, fabric text position, copy width, icon gap and both hero photo boxes — too much for one file.",
          "templates": [
            {
              "id": "template-1",
              "label": "All Over Print",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 1,
              "status": "active",
              "file": "training/women/template-1.json"
            },
            {
              "id": "template-2",
              "label": "Solid",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 1,
              "status": "active",
              "file": "training/women/template-2.json"
            }
          ]
        }
      ]
    },
    {
      "id": "lifestyle",
      "label": "Lifestyle",
      "status": "coming-soon",
      "defaultGender": "men",
      "genders": [
        {
          "id": "men",
          "label": "Men",
          "status": "coming-soon",
          "hero": [
            "COMFORT",
            "REDEFINED"
          ],
          "templates": []
        },
        {
          "id": "women",
          "label": "Women",
          "status": "coming-soon",
          "hero": [
            "COMFORT",
            "REDEFINED"
          ],
          "templates": []
        }
      ]
    },
    {
      "id": "seamless",
      "label": "Seamless",
      "status": "coming-soon",
      "defaultGender": "women",
      "genders": [
        {
          "id": "women",
          "label": "Women",
          "status": "coming-soon",
          "hero": [
            "FLEX",
            "& FLOW"
          ],
          "templates": []
        }
      ]
    }
  ]
};

var FALLBACK_MANIFESTS = {
  "running/men/template-1": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "running",
      "categoryLabel": "Running",
      "version": 2,
      "status": "active",
      "updated": "2026-11-26",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The everyday men's Running A+: hero, Fabric in Focus, then 3 or 4 alternating callouts. Matches 706524 (shorts), 708518 (joggers), 706623 (tank) and 708520 (trackpants) on Page 2.",
      "width": 1572,
      "sliceSplitY": 2961,
      "gender": "men",
      "genderLabel": "Men",
      "label": "Running · Men · Standard"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "fillRole": "white",
      "clip": true,
      "bottomPad": 108.76
    },
    "background": {
      "comment": "Measured layer-for-layer off the real 706524. The glows are radial gradient ellipses (not blurred solids) and the two washes are large rotated rectangles — that is what gives the body its depth.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -9.72,
          "y": 1619.51,
          "w": 1697.24,
          "hToFramePlus": 108,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.66,
                  -0.69
                ],
                [
                  -1.66,
                  0,
                  1.33
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.39,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.932,
              -0.363,
              194.096
            ],
            [
              -0.363,
              -0.932,
              3382.993
            ]
          ],
          "w": 2298.48,
          "h": 1808.04,
          "fills": [
            {
              "gt": [
                [
                  -0.56,
                  -0.4,
                  1.29
                ],
                [
                  3.47,
                  -11.67,
                  1.42
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.27
            ],
            [
              -0.417,
              0.909,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2,
                  0.36,
                  0.93
                ],
                [
                  0.5,
                  -25.56,
                  13.24
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1126.104
            ],
            [
              0.417,
              -0.909,
              5312.91
            ]
          ],
          "yFromBottom": 67.09,
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "gt": [
                [
                  -0.89,
                  -0.26,
                  1.22
                ],
                [
                  2.04,
                  -18.16,
                  9.39
                ]
              ],
              "stops": [
                [
                  0.32,
                  [
                    45,
                    44,
                    46
                  ],
                  0.6
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "Layer order is the real 706524 hero, in its own z-order. The two stacked model images in the original (`_C mot` / `_C bg`) collapse into the single `model` slot; everything else is layer for layer.",
      "layers": [
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.13,
                  1.13,
                  -0.19
                ],
                [
                  -1.13,
                  0.07,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.046
            ],
            [
              0.314,
              0.95,
              -237.721
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "fills": [
            {
              "gt": [
                [
                  -0.79,
                  -0.56,
                  1.48
                ],
                [
                  3.71,
                  -16.02,
                  8.09
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    28,
                    26,
                    31
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "bgPhoto"
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "fills": [
            {
              "gt": [
                [
                  -1.74,
                  -0.21,
                  1.8
                ],
                [
                  0.25,
                  -2.84,
                  1.36
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    28,
                    27,
                    31
                  ],
                  0.5
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "image 396 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background photo (full bleed)",
        "x": -125,
        "y": -226,
        "w": 1825,
        "h": 2102,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 754.68,
        "lhPct": 87,
        "ls": -45.28,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 17.21,
        "fills": [
          {
            "transform": "TB",
            "stops": [
              [
                0.22,
                [
                  8,
                  8,
                  8
                ],
                0.67
              ],
              [
                0.82,
                [
                  75,
                  92,
                  124
                ],
                0.67
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 229.76,
        "lhPct": 87,
        "ls": -4.6,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 611.58,
        "blur": 6
      },
      "model": {
        "comment": "Matches the footprint of the original's stacked `_C mot` / `_C bg` model images, which this single slot replaces.",
        "name": "Hero model photo · men's running",
        "x": 268,
        "y": 122,
        "w": 1039,
        "h": 1408,
        "fillOpacity": 0.35,
        "label": "Hero model photo · men's running"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 429,
        "x": 1092.9,
        "y": 825.95
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -4.99,
        "y": 1615,
        "w": 1578.76,
        "h": 1346.12,
        "radius": 5.67,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 57.74,
        "y": 54.85,
        "w": 1467.34,
        "h": 1286.4,
        "opacity": 0.8,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 576,
        "y": 119,
        "w": 426,
        "h": 426,
        "circle": true,
        "labelSize": 30,
        "label": "Fabric close-up"
      },
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 55.67,
          "y": 54,
          "w": 1473.96,
          "h": 1288.03,
          "opacity": 0.35,
          "comment": "Switched off in the real 706524 — kept here, hidden, so the option is visible to the designer.",
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Dark overlay",
          "x": 0,
          "y": 0,
          "w": 1578.76,
          "h": 1346.12,
          "radius": 5.67,
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.46,
                  0.34,
                  0.12
                ],
                [
                  -0.34,
                  0.33,
                  0.53
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ],
                [
                  0.54,
                  [
                    21,
                    0,
                    0
                  ],
                  0.5
                ],
                [
                  1,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2205,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1372,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.67,
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.47,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 40,
          "cross": "CENTER",
          "max": 4
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2211.45,
        "h3": 1652.21
      },
      "barHeight": 385.4,
      "bar": {
        "name": "Bar",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 67.82,
            "y": 0.21,
            "d": 517
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 595,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 601.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545.21,
            "d": 517.24
          },
          "text": {
            "right": 672.2,
            "w": 635,
            "copyW": 635,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1200.65,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 65.82,
            "y": 1133.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 605,
            "copyW": 605,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 1694.21,
            "d": 517.24
          },
          "text": {
            "right": 674.82,
            "w": 653,
            "copyW": 653,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "The Regular-fit vs Slim-fit card, measured layer for layer off 706327. The two photo slots overlap by ~99px exactly as in the original, because the fit shots carry transparent padding. Off by default; a template turns it on with \"enabled\": true, and the designer can also add it to any finished frame from the plugin.",
      "enabled": false,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "comment": "Alignment rules the designers draw by hand: one vertical per fit, and two horizontal rows each drawn as two offset spans.",
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2961
      },
      {
        "name": "2",
        "y": 2961,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. B=style IDs, C=category, G=headline ('RUN UNSTOPPABLE' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "RUN",
        "UNSTOPPABLE",
        "Gear up to outrun the ordinary."
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "running/men/template-2": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "running",
      "categoryLabel": "Running",
      "version": 2,
      "status": "active",
      "updated": "2026-11-26",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "Same as Men · Standard, plus the Regular-fit vs Slim-fit comparison card at the bottom. Use it for styles where the fit is the story.",
      "width": 1572,
      "sliceSplitY": 2961,
      "gender": "men",
      "genderLabel": "Men",
      "label": "Running · Men · With fit comparison"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "fillRole": "white",
      "clip": true,
      "bottomPad": 108.76
    },
    "background": {
      "comment": "Measured layer-for-layer off the real 706524. The glows are radial gradient ellipses (not blurred solids) and the two washes are large rotated rectangles — that is what gives the body its depth.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -9.72,
          "y": 1619.51,
          "w": 1697.24,
          "hToFramePlus": 108,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.66,
                  -0.69
                ],
                [
                  -1.66,
                  0,
                  1.33
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.39,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.932,
              -0.363,
              194.096
            ],
            [
              -0.363,
              -0.932,
              3382.993
            ]
          ],
          "w": 2298.48,
          "h": 1808.04,
          "fills": [
            {
              "gt": [
                [
                  -0.56,
                  -0.4,
                  1.29
                ],
                [
                  3.47,
                  -11.67,
                  1.42
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.27
            ],
            [
              -0.417,
              0.909,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2,
                  0.36,
                  0.93
                ],
                [
                  0.5,
                  -25.56,
                  13.24
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1126.104
            ],
            [
              0.417,
              -0.909,
              5312.91
            ]
          ],
          "yFromBottom": 67.09,
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "gt": [
                [
                  -0.89,
                  -0.26,
                  1.22
                ],
                [
                  2.04,
                  -18.16,
                  9.39
                ]
              ],
              "stops": [
                [
                  0.32,
                  [
                    45,
                    44,
                    46
                  ],
                  0.6
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "Layer order is the real 706524 hero, in its own z-order. The two stacked model images in the original (`_C mot` / `_C bg`) collapse into the single `model` slot; everything else is layer for layer.",
      "layers": [
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.13,
                  1.13,
                  -0.19
                ],
                [
                  -1.13,
                  0.07,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.046
            ],
            [
              0.314,
              0.95,
              -237.721
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "fills": [
            {
              "gt": [
                [
                  -0.79,
                  -0.56,
                  1.48
                ],
                [
                  3.71,
                  -16.02,
                  8.09
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    28,
                    26,
                    31
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "bgPhoto"
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "fills": [
            {
              "gt": [
                [
                  -1.74,
                  -0.21,
                  1.8
                ],
                [
                  0.25,
                  -2.84,
                  1.36
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    28,
                    27,
                    31
                  ],
                  0.5
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "image 396 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background photo (full bleed)",
        "x": -125,
        "y": -226,
        "w": 1825,
        "h": 2102,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 754.68,
        "lhPct": 87,
        "ls": -45.28,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 17.21,
        "fills": [
          {
            "transform": "TB",
            "stops": [
              [
                0.22,
                [
                  8,
                  8,
                  8
                ],
                0.67
              ],
              [
                0.82,
                [
                  75,
                  92,
                  124
                ],
                0.67
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 229.76,
        "lhPct": 87,
        "ls": -4.6,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 611.58,
        "blur": 6
      },
      "model": {
        "comment": "Matches the footprint of the original's stacked `_C mot` / `_C bg` model images, which this single slot replaces.",
        "name": "Hero model photo · men's running",
        "x": 268,
        "y": 122,
        "w": 1039,
        "h": 1408,
        "fillOpacity": 0.35,
        "label": "Hero model photo · men's running"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 429,
        "x": 1092.9,
        "y": 825.95
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -4.99,
        "y": 1615,
        "w": 1578.76,
        "h": 1346.12,
        "radius": 5.67,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 57.74,
        "y": 54.85,
        "w": 1467.34,
        "h": 1286.4,
        "opacity": 0.8,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 576,
        "y": 119,
        "w": 426,
        "h": 426,
        "circle": true,
        "labelSize": 30,
        "label": "Fabric close-up"
      },
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 55.67,
          "y": 54,
          "w": 1473.96,
          "h": 1288.03,
          "opacity": 0.35,
          "comment": "Switched off in the real 706524 — kept here, hidden, so the option is visible to the designer.",
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Dark overlay",
          "x": 0,
          "y": 0,
          "w": 1578.76,
          "h": 1346.12,
          "radius": 5.67,
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.46,
                  0.34,
                  0.12
                ],
                [
                  -0.34,
                  0.33,
                  0.53
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ],
                [
                  0.54,
                  [
                    21,
                    0,
                    0
                  ],
                  0.5
                ],
                [
                  1,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2205,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1372,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.67,
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.47,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 40,
          "cross": "CENTER",
          "max": 4
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2211.45,
        "h3": 1652.21
      },
      "barHeight": 385.4,
      "bar": {
        "name": "Bar",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 67.82,
            "y": 0.21,
            "d": 517
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 595,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 601.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545.21,
            "d": 517.24
          },
          "text": {
            "right": 672.2,
            "w": 635,
            "copyW": 635,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1200.65,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 65.82,
            "y": 1133.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 605,
            "copyW": 605,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 1694.21,
            "d": 517.24
          },
          "text": {
            "right": 674.82,
            "w": 653,
            "copyW": 653,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "The Regular-fit vs Slim-fit card, measured layer for layer off 706327. The two photo slots overlap by ~99px exactly as in the original, because the fit shots carry transparent padding. Off by default; a template turns it on with \"enabled\": true, and the designer can also add it to any finished frame from the plugin.",
      "enabled": true,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "comment": "Alignment rules the designers draw by hand: one vertical per fit, and two horizontal rows each drawn as two offset spans.",
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2961
      },
      {
        "name": "2",
        "y": 2961,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. B=style IDs, C=category, G=headline ('RUN UNSTOPPABLE' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "RUN",
        "UNSTOPPABLE",
        "Gear up to outrun the ordinary."
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "running/women/template-1": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "running",
      "categoryLabel": "Running",
      "version": 2,
      "status": "active",
      "updated": "2026-11-26",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The everyday women's Running A+: hero, Fabric in Focus, then 3 or 4 alternating callouts. Matches 706591 (tights), 706399 (graphic tee) and 706877 (sports bra) on Page 2.",
      "width": 1572,
      "sliceSplitY": 2961,
      "gender": "women",
      "genderLabel": "Women",
      "label": "Running · Women · Standard"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "fillRole": "white",
      "clip": true,
      "bottomPad": 108.76
    },
    "background": {
      "comment": "Measured layer-for-layer off the real 706524. The glows are radial gradient ellipses (not blurred solids) and the two washes are large rotated rectangles — that is what gives the body its depth.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -9.72,
          "y": 1619.51,
          "w": 1697.24,
          "hToFramePlus": 108,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.66,
                  -0.69
                ],
                [
                  -1.66,
                  0,
                  1.33
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.39,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.932,
              -0.363,
              194.096
            ],
            [
              -0.363,
              -0.932,
              3382.993
            ]
          ],
          "w": 2298.48,
          "h": 1808.04,
          "fills": [
            {
              "gt": [
                [
                  -0.56,
                  -0.4,
                  1.29
                ],
                [
                  3.47,
                  -11.67,
                  1.42
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.27
            ],
            [
              -0.417,
              0.909,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2,
                  0.36,
                  0.93
                ],
                [
                  0.5,
                  -25.56,
                  13.24
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1126.104
            ],
            [
              0.417,
              -0.909,
              5312.91
            ]
          ],
          "yFromBottom": 67.09,
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "gt": [
                [
                  -0.63,
                  0.15,
                  0.99
                ],
                [
                  0.38,
                  -13.33,
                  7.13
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    31,
                    30,
                    31
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "The women's files stack the hero differently from the men's: the backing plate is the bottom-most layer, and the texture sits BELOW the bottom shade rather than above it. Order here is 706327's, layer for layer.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.13,
                  1.13,
                  -0.19
                ],
                [
                  -1.13,
                  0.07,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.046
            ],
            [
              0.314,
              0.95,
              -237.721
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "fills": [
            {
              "gt": [
                [
                  -0.82,
                  -0.54,
                  1.48
                ],
                [
                  3.55,
                  -16.71,
                  8.49
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    72,
                    72,
                    74
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "image 394 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "fills": [
            {
              "gt": [
                [
                  -1.74,
                  -0.21,
                  1.8
                ],
                [
                  0.25,
                  -2.84,
                  1.36
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background plate (full bleed)",
        "x": -21,
        "y": -2,
        "w": 1614,
        "h": 1614,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background plate (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 754.68,
        "lhPct": 87,
        "ls": -45.28,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 17.21,
        "fills": [
          {
            "transform": "TB",
            "stops": [
              [
                0.22,
                [
                  8,
                  8,
                  8
                ],
                0.67
              ],
              [
                0.82,
                [
                  75,
                  92,
                  124
                ],
                0.67
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 229.76,
        "lhPct": 87,
        "ls": -4.6,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 611.58,
        "blur": 6
      },
      "model": {
        "comment": "Matches the footprint of the original's stacked `_C mot` / `_C bg` model images, which this single slot replaces.",
        "name": "Hero model photo · women’s running",
        "x": 268,
        "y": 122,
        "w": 1039,
        "h": 1408,
        "fillOpacity": 0.35,
        "label": "Hero model photo · women’s running"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 429,
        "x": 1092.9,
        "y": 825.95
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -4.99,
        "y": 1615,
        "w": 1578.76,
        "h": 1346.12,
        "radius": 5.67,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 57.74,
        "y": 54.85,
        "w": 1467.34,
        "h": 1286.4,
        "opacity": 0.8,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 539.18,
        "y": 51.94,
        "w": 503.63,
        "h": 503.63,
        "circle": true,
        "labelSize": 32,
        "label": "Fabric close-up"
      },
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 55.67,
          "y": 54,
          "w": 1473.96,
          "h": 1288.03,
          "opacity": 0.35,
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Light overlay",
          "x": 0,
          "y": 0,
          "w": 1578.76,
          "h": 1346.12,
          "radius": 5.67,
          "fills": [
            {
              "opacity": 0.35,
              "gt": [
                [
                  0.56,
                  0.4,
                  -0.04
                ],
                [
                  -0.4,
                  0.4,
                  0.54
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  0.54,
                  [
                    255,
                    255,
                    255
                  ],
                  0.28
                ],
                [
                  1,
                  [
                    255,
                    255,
                    255
                  ],
                  0.51
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        },
        {
          "role": "ring"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2205,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1372,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.67,
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.47,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 40,
          "cross": "CENTER",
          "max": 4
        }
      },
      "overflowWarnY": 2950,
      "ring": {
        "name": "Fabric close-up ring",
        "x": 539.18,
        "y": 51.94,
        "w": 503.63,
        "h": 503.63,
        "strokeRole": "white",
        "strokeOpacity": 0.47,
        "strokeWeight": 1.94
      }
    },
    "callouts": {
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2211.45,
        "h3": 1652.21
      },
      "barHeight": 385.4,
      "bar": {
        "name": "Bar",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 67.82,
            "y": 0.21,
            "d": 517
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 595,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 601.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545.21,
            "d": 517.24
          },
          "text": {
            "right": 672.2,
            "w": 635,
            "copyW": 635,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1200.65,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 65.82,
            "y": 1133.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 605,
            "copyW": 605,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 1694.21,
            "d": 517.24
          },
          "text": {
            "right": 674.82,
            "w": 653,
            "copyW": 653,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "The Regular-fit vs Slim-fit card, measured layer for layer off 706327. The two photo slots overlap by ~99px exactly as in the original, because the fit shots carry transparent padding. Off by default; a template turns it on with \"enabled\": true, and the designer can also add it to any finished frame from the plugin.",
      "enabled": false,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "comment": "Alignment rules the designers draw by hand: one vertical per fit, and two horizontal rows each drawn as two offset spans.",
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2961
      },
      {
        "name": "2",
        "y": 2961,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. B=style IDs, C=category, G=headline ('RUN UNSTOPPABLE' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "RUN",
        "UNSTOPPABLE",
        "Gear up to outrun the ordinary."
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "running/women/template-2": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "running",
      "categoryLabel": "Running",
      "version": 2,
      "status": "active",
      "updated": "2026-11-26",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "Same as Women · Standard, plus the Regular-fit vs Slim-fit comparison card at the bottom. This is the 706327 layout, which is where the comparison geometry was measured from.",
      "width": 1572,
      "sliceSplitY": 2961,
      "gender": "women",
      "genderLabel": "Women",
      "label": "Running · Women · With fit comparison"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "fillRole": "white",
      "clip": true,
      "bottomPad": 108.76
    },
    "background": {
      "comment": "Measured layer-for-layer off the real 706524. The glows are radial gradient ellipses (not blurred solids) and the two washes are large rotated rectangles — that is what gives the body its depth.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -9.72,
          "y": 1619.51,
          "w": 1697.24,
          "hToFramePlus": 108,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.66,
                  -0.69
                ],
                [
                  -1.66,
                  0,
                  1.33
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.39,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.932,
              -0.363,
              194.096
            ],
            [
              -0.363,
              -0.932,
              3382.993
            ]
          ],
          "w": 2298.48,
          "h": 1808.04,
          "fills": [
            {
              "gt": [
                [
                  -0.56,
                  -0.4,
                  1.29
                ],
                [
                  3.47,
                  -11.67,
                  1.42
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.27
            ],
            [
              -0.417,
              0.909,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2,
                  0.36,
                  0.93
                ],
                [
                  0.5,
                  -25.56,
                  13.24
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1126.104
            ],
            [
              0.417,
              -0.909,
              5312.91
            ]
          ],
          "yFromBottom": 67.09,
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "gt": [
                [
                  -0.63,
                  0.15,
                  0.99
                ],
                [
                  0.38,
                  -13.33,
                  7.13
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    31,
                    30,
                    31
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "The women's files stack the hero differently from the men's: the backing plate is the bottom-most layer, and the texture sits BELOW the bottom shade rather than above it. Order here is 706327's, layer for layer.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.13,
                  1.13,
                  -0.19
                ],
                [
                  -1.13,
                  0.07,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.046
            ],
            [
              0.314,
              0.95,
              -237.721
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "fills": [
            {
              "gt": [
                [
                  -0.82,
                  -0.54,
                  1.48
                ],
                [
                  3.55,
                  -16.71,
                  8.49
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    72,
                    72,
                    74
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "image 394 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "fills": [
            {
              "gt": [
                [
                  -1.74,
                  -0.21,
                  1.8
                ],
                [
                  0.25,
                  -2.84,
                  1.36
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background plate (full bleed)",
        "x": -21,
        "y": -2,
        "w": 1614,
        "h": 1614,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background plate (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 754.68,
        "lhPct": 87,
        "ls": -45.28,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 17.21,
        "fills": [
          {
            "transform": "TB",
            "stops": [
              [
                0.22,
                [
                  8,
                  8,
                  8
                ],
                0.67
              ],
              [
                0.82,
                [
                  75,
                  92,
                  124
                ],
                0.67
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 229.76,
        "lhPct": 87,
        "ls": -4.6,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 611.58,
        "blur": 6
      },
      "model": {
        "comment": "Matches the footprint of the original's stacked `_C mot` / `_C bg` model images, which this single slot replaces.",
        "name": "Hero model photo · women’s running",
        "x": 268,
        "y": 122,
        "w": 1039,
        "h": 1408,
        "fillOpacity": 0.35,
        "label": "Hero model photo · women’s running"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 429,
        "x": 1092.9,
        "y": 825.95
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -4.99,
        "y": 1615,
        "w": 1578.76,
        "h": 1346.12,
        "radius": 5.67,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 57.74,
        "y": 54.85,
        "w": 1467.34,
        "h": 1286.4,
        "opacity": 0.8,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 539.18,
        "y": 51.94,
        "w": 503.63,
        "h": 503.63,
        "circle": true,
        "labelSize": 32,
        "label": "Fabric close-up"
      },
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 55.67,
          "y": 54,
          "w": 1473.96,
          "h": 1288.03,
          "opacity": 0.35,
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Light overlay",
          "x": 0,
          "y": 0,
          "w": 1578.76,
          "h": 1346.12,
          "radius": 5.67,
          "fills": [
            {
              "opacity": 0.35,
              "gt": [
                [
                  0.56,
                  0.4,
                  -0.04
                ],
                [
                  -0.4,
                  0.4,
                  0.54
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  0.54,
                  [
                    255,
                    255,
                    255
                  ],
                  0.28
                ],
                [
                  1,
                  [
                    255,
                    255,
                    255
                  ],
                  0.51
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        },
        {
          "role": "ring"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2205,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1372,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.67,
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.47,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 40,
          "cross": "CENTER",
          "max": 4
        }
      },
      "overflowWarnY": 2950,
      "ring": {
        "name": "Fabric close-up ring",
        "x": 539.18,
        "y": 51.94,
        "w": 503.63,
        "h": 503.63,
        "strokeRole": "white",
        "strokeOpacity": 0.47,
        "strokeWeight": 1.94
      }
    },
    "callouts": {
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2211.45,
        "h3": 1652.21
      },
      "barHeight": 385.4,
      "bar": {
        "name": "Bar",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 67.82,
            "y": 0.21,
            "d": 517
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 595,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 601.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545.21,
            "d": 517.24
          },
          "text": {
            "right": 672.2,
            "w": 635,
            "copyW": 635,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1200.65,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 65.82,
            "y": 1133.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 605,
            "copyW": 605,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 1694.21,
            "d": 517.24
          },
          "text": {
            "right": 674.82,
            "w": 653,
            "copyW": 653,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "The Regular-fit vs Slim-fit card, measured layer for layer off 706327. The two photo slots overlap by ~99px exactly as in the original, because the fit shots carry transparent padding. Off by default; a template turns it on with \"enabled\": true, and the designer can also add it to any finished frame from the plugin.",
      "enabled": true,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "comment": "Alignment rules the designers draw by hand: one vertical per fit, and two horizontal rows each drawn as two offset spans.",
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2961
      },
      {
        "name": "2",
        "y": 2961,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. B=style IDs, C=category, G=headline ('RUN UNSTOPPABLE' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "RUN",
        "UNSTOPPABLE",
        "Gear up to outrun the ordinary."
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "training/men/template-1": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "training",
      "categoryLabel": "Training",
      "version": 1,
      "status": "active",
      "updated": "2026-11-27",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The everyday men's Training A+: hero, Fabric in Focus, then 3 or 4 alternating callouts. Measured off all three men's Training designs on Page 2 — Compression Top Solid 2 (1097:1514, 707041/707042/707044), Trackpants Graphic (1097:1383, 707564/707565/707566) and Shorts Graphic 1 (1097:1633, 707175/707176/707177). Only one men's template exists because the three designs are structurally identical: same hero stack, same fabric card, same alternating callout rig, no extra block in any of them. What separates them is the accent colour (meta.artDirection) and how many features the sheet row fills, and neither is a template.",
      "width": 1572,
      "sliceSplitY": 2960,
      "artDirection": {
        "comment": "What a template cannot fix, because it is per-style, not per-gender. Two layers carry each Training style's accent colour — the body 'Wash · lower' and the hero 'Hero shade · right'. All three men's designs share their geometry exactly and differ only in this colour. The base ships the Compression Top's maroon; the designer recolours those two layers per style.",
        "accentLayers": [
          "Wash · lower",
          "Hero shade · right"
        ],
        "measured": {
          "707041/707042/707044 · Compression Top Solid 2": {
            "wash": [
              170,
              72,
              89
            ],
            "heroShade": [
              170,
              82,
              96
            ]
          },
          "707564/707565/707566 · Trackpants Graphic": {
            "wash": [
              72,
              103,
              88
            ],
            "heroShade": [
              82,
              111,
              100
            ]
          },
          "707175/707176/707177 · Shorts Graphic 1": {
            "wash": [
              114,
              63,
              137
            ],
            "heroShade": [
              109,
              54,
              122
            ]
          }
        }
      },
      "notExpressible": [
        "The fabric card (`Frame 852`) carries a GLASS effect (radius 16.903) in all three designs. The renderer gives the fabric box a solid fill and no effects, so the effect is dropped; the card's gradient veil itself IS reproduced, as the 'Dark overlay' layer.",
        "The hero italic word is x-centred by the renderer. The originals place it ~35px right of centre (x 139.6 / 145 against a centred 105), which the manifest cannot express because hero.italic has no x.",
        "The callout bar is a single white gradient at paint opacity 0.58 on a rotated matrix; the renderer only builds bars with the fixed LR/RL directions, so it is approximated with three stops (unchanged from running/_base).",
        "The `Fabric in Focus` heading carries a disabled DROP_SHADOW in all three designs; the renderer's textStack has no effects field, so it is not reproduced (it is switched off anyway)."
      ],
      "knownDeviations": [
        "Rendered frame heights match the real designs exactly — 1572 x 4743 for a 3-feature row (Compression Top, Shorts) and 1572 x 5380 for a 4-feature one (Trackpants, real 5379.69). What does NOT match is the spacing WITHIN a 3-callout frame: the two hand-made 3-callout designs pack their three cards ~45px tighter than the Trackpants' four-card rig, and one `callouts.cards` array has to serve both, so the Trackpants spacing is used and the slack lands below card 3.",
        "'Wash · lower' is bottom-anchored (yFromBottom 66.78, the Trackpants/Running placement). The two 3-callout designs park it 211px lower on a fixed y with a different gradient matrix.",
        "Hidden leftovers NOT reproduced, as orphans the project set out to clean up: a hidden duplicate of 'Glow · right lower' (Ellipse 87), a hidden fabric photo (705963_C), a hidden wash entirely below the frame (Rectangle 42140, y 5685), and a hidden hero model photo (948a6666…). The hidden layers that ARE reproduced are the two alternate gradients and the fabric Photo wash."
      ],
      "gender": "men",
      "genderLabel": "Men",
      "label": "Training · Men · Standard",
      "hero": [
        "TRAIN",
        "FEARLESS"
      ]
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "comment": "ink and tag are read off the real Training text nodes (callout copy rgb(21,0,0), hero tagline rgb(113,119,124)). fabricBg is carried over from running/_base: the Training fabric card (Frame 852) has NO solid base fill at all, only the dark gradient that this manifest draws as the 'Dark overlay' layer, so a base colour had to be chosen — it is almost entirely covered by the fabric photo and the overlay.",
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "comment": "bottomPad is 0 and the padding below the last callout is folded into callouts.frame.h3 / h4 instead. It has to be: the two 3-callout Training designs leave 18.85px and 29.85px below their callouts frame and the 4-callout one leaves 101.18px, so no single bottomPad reproduces both real heights. Folding it in does — see callouts.frame.",
      "fillRole": "white",
      "clip": true,
      "bottomPad": 0
    },
    "background": {
      "comment": "Frame-level art, in the z-order of the real Training files (which differs from Running: the two body washes are drawn BEFORE the fabric wash, not after). The glows are radial-gradient ellipses and the washes are large rotated rectangles — 'Wash · lower' is also FLIPPED (negative determinant), so it carries the full rt matrix.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -10,
          "y": 1616,
          "w": 1697,
          "hToFramePlus": 0,
          "comment": "Compression Top / Shorts both run this to the frame bottom exactly (hToFramePlus 0). The Trackpants runs it 108.28 past, as Running does.",
          "fills": [
            {
              "gt": [
                [
                  0.0003,
                  1.6641,
                  -0.6867
                ],
                [
                  -1.6641,
                  0,
                  1.3319
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.3942,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.2105,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "BG gradient · alternate",
          "x": -11.33,
          "y": 3008.42,
          "w": 1699.25,
          "h": 1784.86,
          "comment": "Switched off in the Compression Top and the Shorts (Rectangle 42153) and absent from the Trackpants. Kept here, hidden, so the option stays visible to the designer — same convention as the Running fabric Photo wash.",
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  0.0002,
                  0.8941,
                  -0.0001
                ],
                [
                  -0.8941,
                  0.0001,
                  0.9471
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ],
                [
                  0.4332,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.2223,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.2105,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.90901,
              -0.41677,
              1126.1
            ],
            [
              0.41677,
              -0.90901,
              5312.91
            ]
          ],
          "yFromBottom": 66.78,
          "w": 1083.76,
          "h": 2786.28,
          "comment": "The accent wash — this is the layer that carries each style's colour. Anchored to the frame bottom, so it has to be the Trackpants/Running placement; the two 3-callout frames park it 211px lower with a slightly different gradient matrix. The stop colour here is the Compression Top's maroon; see meta.artDirection.",
          "fills": [
            {
              "gt": [
                [
                  -0.8881,
                  -0.2636,
                  1.2157
                ],
                [
                  2.0353,
                  -18.1559,
                  9.3857
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    170,
                    72,
                    89
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.90901,
              0.41677,
              162.27
            ],
            [
              -0.41677,
              0.90901,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "comment": "Byte-identical in all three Training designs and in running/_base.",
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2029,
                  0.3601,
                  0.9336
                ],
                [
                  0.4951,
                  -25.5645,
                  13.2355
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.92133,
              -0.33749,
              194.09
            ],
            [
              -0.38878,
              -0.94133,
              3512.98
            ]
          ],
          "w": 2325.05,
          "h": 1942.02,
          "comment": "Flipped as well as rotated (determinant -0.9985), so it must keep its full rt matrix. Geometry is the Compression Top / Shorts one (2 of 3); the Trackpants uses the slightly smaller Running box 2298.81 x 1809.75 at ty 3383.",
          "fills": [
            {
              "gt": [
                [
                  -0.5553,
                  -0.4038,
                  1.2941
                ],
                [
                  3.4689,
                  -11.673,
                  1.4173
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "Layer order is the Compression Top / Shorts hero (`SOLID Frame 54`), layer for layer. The real heroes stack up to four full-bleed 1575 x ~1599 colourway photographs on top of each other; they all collapse into the single `bgPhoto` slot, which is placed where the topmost one sits. The halftone texture appears TWICE in every Training hero (`image 394` below the photo stack, `image 395` above it) — both are kept, with the identical paint the originals carry.",
      "layers": [
        {
          "name": "Hero backdrop · trr3",
          "x": -60,
          "y": -40,
          "w": 1696,
          "h": 1696,
          "comment": "Bottom-most layer in the Compression Top and the Shorts: a shared backdrop graphic (same imageHash in both), not a per-style photograph, so it stays a specified layer rather than a slot. The Trackpants puts a style photo here instead. An imageHash only resolves inside the Figma file that holds the bytes — the renderer drops it with a warning elsewhere.",
          "fills": [
            {
              "image": "ec31933d587a4a4f2f4fad740048399f56e09fe7",
              "scale": "FILL",
              "scalingFactor": 0.5
            }
          ]
        },
        {
          "name": "image 394 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.7446,
              0.66751,
              -321.64
            ],
            [
              0.66751,
              -0.7446,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "comment": "Flipped as well as rotated (determinant -1.0) — rt, not rotation. Identical box and gradient matrix in all three Training designs and in running/_base; only the first stop colour changes (near-white here, white on the Trackpants, near-black on Running men's).",
          "fills": [
            {
              "gt": [
                [
                  -1.7363,
                  -0.2115,
                  1.799
                ],
                [
                  0.2543,
                  -2.8369,
                  1.3611
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    237,
                    234,
                    233
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · alternate",
          "rt": [
            [
              -0.94957,
              0.31356,
              1543.71
            ],
            [
              -0.31356,
              -0.94957,
              1757.41
            ]
          ],
          "w": 2104.41,
          "h": 1653.62,
          "comment": "Switched off in the Compression Top and the Shorts. Kept hidden so the designer can see the option.",
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  -1.6769,
                  -0.5822,
                  2.0699
                ],
                [
                  -1.8535,
                  -31.1008,
                  25.455
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    139,
                    139,
                    139
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.1339,
                  1.126,
                  -0.1929
                ],
                [
                  -1.126,
                  0.067,
                  0.996
                ]
              ],
              "stops": [
                [
                  0.2223,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "bgPhoto"
        },
        {
          "name": "image 395 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.94957,
              -0.31356,
              960.05
            ],
            [
              0.31356,
              0.94957,
              -237.72
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "comment": "The second accent layer. Same box in all three Training designs; the Compression Top and the Shorts share this gradient matrix, the Trackpants uses Running's. The stop colour is per-style art direction — see meta.artDirection.",
          "fills": [
            {
              "gt": [
                [
                  -0.6421,
                  -0.5016,
                  1.4194
                ],
                [
                  3.3802,
                  -13.1219,
                  6.6317
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    170,
                    82,
                    96
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background photo · men's training",
        "x": 0,
        "y": -1,
        "w": 1575,
        "h": 1599,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo · men's training"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 536.553,
        "lhPct": 87,
        "ls": -32.19,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 13.52,
        "comment": "ls is the original's -6% of 536.553px. At this size 'TRAIN' measures 1464 wide, exactly as in the originals; longer words are scaled down to maxWidth by the renderer.",
        "fills": [
          {
            "opacity": 0.67,
            "gt": [
              [
                0.0795,
                0.8811,
                0.2121
              ],
              [
                -8.6741,
                0.0795,
                5.2407
              ]
            ],
            "stops": [
              [
                0,
                [
                  8,
                  8,
                  8
                ],
                1
              ],
              [
                1,
                [
                  75,
                  92,
                  124
                ],
                1
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 321.613,
        "lhPct": 87,
        "ls": -6.43,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 412.46,
        "blur": 16.903
      },
      "model": {
        "comment": "The real heroes stack a hidden model photo under the live one; only the live one is reproduced. Box is the Compression Top's; the Shorts uses (245, -3, 1157 x 1601) and the Trackpants (233, 0, 1192 x 1615).",
        "name": "Hero model photo · men's training",
        "x": 237,
        "y": 8,
        "w": 1170,
        "h": 1586,
        "fillOpacity": 0.35,
        "label": "Hero model photo · men's training"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 371,
        "x": 1140,
        "y": 706
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -3,
        "y": 1616,
        "w": 1578,
        "h": 1344,
        "radius": 5.672,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 56,
        "y": 56,
        "w": 1467,
        "h": 1250,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 582,
        "y": 92,
        "w": 413,
        "h": 413,
        "circle": true,
        "labelSize": 30,
        "label": "Fabric close-up"
      },
      "comment": "fabric.box starts at y 1616 with height 1344, not the measured y 1599 / height 1361. The renderer draws the hero BEFORE the fabric card, so a box starting at 1599 would paint over the hero's bottom 17px — in the originals the hero is on top. Those 17px sit behind the hero either way, and the 'Dark overlay' layer carries y -17 so its gradient still covers exactly the original 1578 x 1361 box. The bottom still lands on 2960, the export slice boundary. Matches the convention in training/_women. The real Training fabric card (`Frame 852`) carries the dark veil as its OWN gradient fill plus a GLASS effect. The renderer fills the card with a solid palette role, so the veil is reproduced here as the full-size 'Dark overlay' layer (exactly as running/_base does) and the GLASS effect is dropped — see meta.notExpressible. Close-up diameters across the three designs are 443 / 413 / 378; all three are centred on the card's horizontal axis, and 413 (the Trackpants, and the median) is used.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 53.67,
          "y": 54.67,
          "w": 1473.96,
          "h": 1397.34,
          "opacity": 0.35,
          "comment": "Switched off in all three Training designs (Rectangle 42167) — kept here, hidden, so the option is visible to the designer.",
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Dark overlay",
          "x": 0,
          "y": -17,
          "w": 1578,
          "h": 1361,
          "radius": 5.672,
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.4567,
                  0.3437,
                  0.1223
                ],
                [
                  -0.3437,
                  0.3301,
                  0.5301
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ],
                [
                  0.5354,
                  [
                    21,
                    0,
                    0
                  ],
                  0.59
                ],
                [
                  1,
                  [
                    21,
                    0,
                    0
                  ],
                  0.51
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2192,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1487,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.671,
          "comment": "In the Training files this is a VECTOR line with a gradient STROKE (`Vector 87` / `Vector 88`), not a filled rectangle. Reproduced as a 1.671px rectangle carrying the identical gradient as a fill — same pixels.",
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.4723,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 24,
          "cross": "CENTER",
          "max": 4,
          "comment": "24 is measured off the Trackpants' `Frame 861`, the only icon row in the three that is a real auto-layout hug (1077.26 = 304 + 243 + 304.26 + 154 + 3 x 24)."
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "comment": "Card geometry is the Trackpants', the only men's Training design with four callouts. h4 = 2319.9 reproduces that frame at 1572 x 5380 (real 5379.69) and h3 = 1683.21 reproduces the Compression Top and the Shorts at 1572 x 4743 — both exactly, because frame.bottomPad is 0 and each height carries its own bottom padding. Both values still clear their last card (card 3 ends at 1656.21, card 4 at 2211.21), so nothing overhangs the box. The two 3-callout designs do pack their three cards ~45px tighter than the four-card rig; the card array here is the Trackpants', since one array has to serve both.",
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2319.9,
        "h3": 1683.21
      },
      "barHeight": 385.44,
      "bar": {
        "name": "Bar",
        "comment": "The real bar is a single white gradient at paint opacity 0.58 on a rotated matrix. The renderer builds callout bars with the fixed LR/RL directions only, so the same ramp is expressed as three stops at 0.58 — the running/_base approximation, unchanged.",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 75.71,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 64.82,
            "y": 4.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 622,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 612.68,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.82,
            "y": 542.21,
            "d": 519
          },
          "text": {
            "right": 673.82,
            "w": 593,
            "copyW": 559.71,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1201.21,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 62.82,
            "y": 1131.21,
            "d": 525
          },
          "text": {
            "left": 734.82,
            "w": 621,
            "copyW": 621,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.67,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 848.82,
            "y": 1692.21,
            "d": 519
          },
          "text": {
            "right": 673.82,
            "w": 647,
            "copyW": 647,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "NOT measured from any Training design — none of the three men's Training A+ files has a fit-comparison card. The geometry is carried over verbatim from running/_base (measured off the Running 706327) so that the plugin's manual 'add fit comparison to this frame' escape hatch still works on a Training frame. It stays off; re-measure it the day a Training design actually uses one.",
      "enabled": false,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2960
      },
      {
        "name": "2",
        "y": 2960,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. Columns are taken verbatim from the registry's sheet schema (backend/templates/index.json -> sheet), which is the single place the layout is defined: B=style IDs, C=category, G=headline ('TRAIN FEARLESS' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender. Training rows already exist in that sheet.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "TRAIN",
        "FEARLESS",
        "For the bold and the relentless"
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "comment": "titleTallPx is 160 rather than Running's 125 because the Training callout title line height is 75.71px (126.176% of 60), so two lines are already 151px.",
      "titleTallPx": 160,
      "textTallerThanBarPx": 385
    }
  },
  "training/women/template-1": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "training",
      "categoryLabel": "Training",
      "version": 1,
      "status": "active",
      "updated": "2026-11-27",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The all-over-print women's Training A+: hero, Fabric in Focus, then 3 or 4 alternating callouts. Measured off 1097:1740 on Page 2 (styles 707841, 707842), the 3-callout 1572 x 4743 version. Every number is inherited from training/_women, which was measured from this frame — a row with four features renders 1572 x 5327 using the fourth callout slot taken from the Solid design.",
      "width": 1572,
      "sliceSplitY": 2956,
      "artDirection": {
        "comment": "Per-style, not per-gender. The two accent layers are the same ones the men's designs use — the body 'Wash · lower' and the hero 'Hero shade · right' — and the women's designs follow the same rule: the accent matches the garment. _women ships the All Over Print teal; template-2 ships the Solid crimson; the designer recolours those two layers for any other style.",
        "accentLayers": [
          "Wash · lower",
          "Hero shade · right"
        ],
        "measured": {
          "707041/707042/707044 · Compression Top Solid 2": {
            "wash": [
              170,
              72,
              89
            ],
            "heroShade": [
              170,
              82,
              96
            ]
          },
          "707564/707565/707566 · Trackpants Graphic": {
            "wash": [
              72,
              103,
              88
            ],
            "heroShade": [
              82,
              111,
              100
            ]
          },
          "707175/707176/707177 · Shorts Graphic 1": {
            "wash": [
              114,
              63,
              137
            ],
            "heroShade": [
              109,
              54,
              122
            ]
          },
          "707841/707842 · Shorts All Over Print (women)": {
            "wash": [
              94,
              161,
              146
            ],
            "heroShade": [
              71,
              153,
              130
            ]
          },
          "707835/707837/707838 · Shorts Solid (women)": {
            "wash": [
              154,
              28,
              54
            ],
            "heroShade": [
              143,
              24,
              50
            ]
          }
        }
      },
      "notExpressible": [
        "The fabric card (`Frame 852`) carries a GLASS effect (radius 16.903) in both women's designs. The renderer gives the fabric box a solid fill and no effects, so the effect is dropped; the card's gradient veil itself IS reproduced, as the 'Dark overlay' layer.",
        "The hero italic word is x-centred by the renderer. Both originals place it at x 139.6, about 35px right of a centred 105, which the manifest cannot express because hero.italic has no x. Same deviation the men's designs have.",
        "The callout bar's real paint is one white gradient at opacity 0.58 on the matrix [[1.391,0.014,-0.414],[-0.144,1.391,-0.153]]. Resolving that matrix gives solid 58% out to 29.8% of the width then a fade to ~1% — which is what training/_base's three-stop LR approximation already draws, so it is inherited unchanged. Only the matrix's slight shear is lost.",
        "The fabric close-up ring EXISTS in both women's designs (Ellipse 801, white stroke 1.937px at 47% opacity) but is SWITCHED OFF in both. The renderer's `ring` role has no hidden state — it draws the ring unconditionally — so `fabric.ring` is deliberately omitted rather than shipped visible. This is the one place the women's Running split does not carry over: Running women's rings are on, Training women's are off.",
        "The `Fabric in Focus` heading carries a disabled DROP_SHADOW in both designs; the renderer's textStack has no effects field, so it is not reproduced (it is switched off anyway)."
      ],
      "knownDeviations": [
        "fabric.box starts at y 1616 with height 1340, not at the original Frame 852's y 1595 / height 1361. The renderer draws the hero BEFORE the fabric card, so a box starting at 1595 would paint over the hero's bottom 21px — in the originals the hero is on top. Those 21px are hidden behind the hero either way, and the 'Dark overlay' layer is offset by -21 so its gradient covers exactly the original 1578 x 1361 box. Bottom lands on 2956, the export slice boundary. This is a different convention from training/_base, which keeps the men's box at its measured y.",
        "'Wash · lower' is bottom-anchored, but the two women's frames disagree about the anchor: All Over Print sits 144.758px BELOW its bottom edge and Solid 145.242px ABOVE it. There is no reconciling value, so each template carries its own. Its gradient matrix is also the 3-callout lineage's ([[-0.701,-0.083,1.107],[1.211,-14.502,7.637]]), not the Running/Trackpants matrix training/_base inherits.",
        "callouts.title.lh is 60, not the base's 75.71. The women's callout titles measure 60px on a single line and 53-54px on two; 60 is the single-line measurement and matches the Running templates. warnings.titleTallPx goes back to 125 to suit it.",
        "Hidden leftovers NOT reproduced, matching the base's choice: a hidden duplicate of 'Glow · right lower' (Ellipse 87), a hidden wash entirely below the frame (Rectangle 42140, y 5685), a hidden fabric photo belonging to an unrelated style (705963_C), and a second, duplicated close-up mask group in the fabric card. The hidden layers that ARE reproduced are the alternate BG gradient, the alternate hero shade and the fabric Photo wash."
      ],
      "gender": "women",
      "genderLabel": "Women",
      "label": "Training · Women · All Over Print"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "comment": "ink and tag are read off the real Training text nodes (callout copy rgb(21,0,0), hero tagline rgb(113,119,124)). fabricBg is carried over from running/_base: the Training fabric card (Frame 852) has NO solid base fill at all, only the dark gradient that this manifest draws as the 'Dark overlay' layer, so a base colour had to be chosen — it is almost entirely covered by the fabric photo and the overlay.",
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "comment": "Both women's frames end flush: 3027 + 1694.148 callouts + 21.852 = 4743, and 3027 + 2300 + 0 = 5327. The dialect has one bottomPad, so it is 0 and the All Over Print frame's 21.852px trailing pad is folded into callouts.frame.h3 (1716). The callouts frame is unfilled and unclipped, so its height only ever sizes the page.",
      "fillRole": "white",
      "clip": true,
      "bottomPad": 0
    },
    "background": {
      "comment": "Frame-level art of 1097:1740, bottom to top. Same stack as training/_base — only 'Wash · lower' differs, in both placement and gradient matrix. Restated in full because `extends` replaces arrays rather than merging them.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -10,
          "y": 1616,
          "w": 1697,
          "hToFramePlus": 0,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.664,
                  -0.687
                ],
                [
                  -1.664,
                  0,
                  1.332
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.394,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.635,
          "y": 2121.092,
          "w": 1720.796,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "BG gradient · alternate",
          "x": -11.328,
          "y": 3008.417,
          "w": 1699.25,
          "h": 1784.865,
          "comment": "Switched off in both women's designs (Rectangle 42153). Kept hidden so the option stays visible to the designer.",
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  0,
                  0.894,
                  0
                ],
                [
                  -0.894,
                  0,
                  0.947
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ],
                [
                  0.433,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.198,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.086,
          "y": 3171.139,
          "w": 1370.967,
          "h": 969.542,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.222,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.934,
          "y": 3799.368,
          "w": 1720.796,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1190.389
            ],
            [
              0.417,
              -0.909,
              4887.758
            ]
          ],
          "yFromBottom": -144.758,
          "w": 1083.756,
          "h": 2786.279,
          "comment": "Rotated AND flipped (negative determinant), so the whole relativeTransform is stored. The accent layer — teal here, crimson on the Solid design. Bottom-anchored, but the original's ty is 4887.758 on a 4743-tall frame, i.e. 144.758px BELOW the bottom edge, hence the negative yFromBottom. Different gradient matrix from training/_base.",
          "fills": [
            {
              "gt": [
                [
                  -0.701,
                  -0.083,
                  1.107
                ],
                [
                  1.211,
                  -14.502,
                  7.637
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    94,
                    161,
                    146
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.271
            ],
            [
              -0.417,
              0.909,
              2152.149
            ]
          ],
          "w": 1083.756,
          "h": 2786.279,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.203,
                  0.36,
                  0.934
                ],
                [
                  0.495,
                  -25.564,
                  13.235
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.921,
              -0.337,
              194.04
            ],
            [
              -0.389,
              -0.941,
              3512.892
            ]
          ],
          "w": 2325.05,
          "h": 1942.022,
          "fills": [
            {
              "gt": [
                [
                  -0.555,
                  -0.404,
                  1.294
                ],
                [
                  3.469,
                  -11.673,
                  1.417
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": "white",
      "comment": "The women's hero stacks differently from the men's: the full-bleed backing plate is the BOTTOM-most layer, there is only ONE halftone texture (the men's designs carry image 394 AND image 395), there is no shared backdrop graphic, and the bottom shade is drawn BELOW the right-hand shade. Order here is 1097:1740's own, layer for layer. The real frame has NO fill — the dialect always paints one solid, so it is white, the same as the page frame underneath, and the backing-plate slot covers it edge to edge anyway.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "image 394 · texture",
          "x": -1085.187,
          "y": -66.687,
          "w": 2961.445,
          "h": 1681.681,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "rotation": 0,
              "imageTransform": [
                [
                  1,
                  0,
                  0
                ],
                [
                  0,
                  1,
                  0
                ]
              ],
              "filters": {
                "exposure": -1,
                "contrast": 0,
                "saturation": 0,
                "temperature": 0,
                "tint": 0,
                "highlights": 0,
                "shadows": 0
              }
            }
          ]
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.847,
          "h": 2361.402,
          "comment": "Flipped as well as rotated. Box, matrix and the off-white first stop are identical to the men's designs.",
          "fills": [
            {
              "gt": [
                [
                  -1.736,
                  -0.212,
                  1.799
                ],
                [
                  0.254,
                  -2.837,
                  1.361
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    237,
                    234,
                    233
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.047
            ],
            [
              0.314,
              0.95,
              -237.722
            ]
          ],
          "w": 1205.983,
          "h": 1971.466,
          "comment": "Box and gradient matrix identical to the men's; only the stop colour is per-style. Teal on the All Over Print design because the garment is teal — see meta.artDirection.",
          "fills": [
            {
              "gt": [
                [
                  -0.642,
                  -0.502,
                  1.419
                ],
                [
                  3.38,
                  -13.122,
                  6.632
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    71,
                    153,
                    130
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · alternate",
          "rt": [
            [
              -0.95,
              0.314,
              1543.709
            ],
            [
              -0.314,
              -0.95,
              1757.408
            ]
          ],
          "w": 2104.408,
          "h": 1653.617,
          "comment": "Switched off in both women's designs, as in the men's. Kept hidden so the designer can see the option.",
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  -1.677,
                  -0.582,
                  2.07
                ],
                [
                  -1.853,
                  -31.101,
                  25.455
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    139,
                    139,
                    139
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.756,
          "y": -530.762,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.134,
                  1.126,
                  -0.193
                ],
                [
                  -1.126,
                  0.067,
                  0.996
                ]
              ],
              "stops": [
                [
                  0.222,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background photo (full bleed)",
        "x": -77,
        "y": -201,
        "w": 1730,
        "h": 2080,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 536.553,
        "lhPct": 87,
        "ls": -32.19,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 13.52,
        "comment": "ls is the original's -6% of 536.553px. At this size 'TRAIN' measures 1464 wide, exactly as in the originals; longer words are scaled down to maxWidth by the renderer.",
        "fills": [
          {
            "opacity": 0.67,
            "gt": [
              [
                0.0795,
                0.8811,
                0.2121
              ],
              [
                -8.6741,
                0.0795,
                5.2407
              ]
            ],
            "stops": [
              [
                0,
                [
                  8,
                  8,
                  8
                ],
                1
              ],
              [
                1,
                [
                  75,
                  92,
                  124
                ],
                1
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 321.613,
        "lhPct": 87,
        "ls": -6.43,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 412.46,
        "blur": 16.903
      },
      "model": {
        "comment": "Measured off 705540_D bg 1. The women's heroes carry a single model photograph, not the men's stack.",
        "name": "Hero model photo · women's training",
        "x": 250,
        "y": 120,
        "w": 1076,
        "h": 1438,
        "fillOpacity": 0.35,
        "label": "Hero model photo · women's training"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 371,
        "x": 1140,
        "y": 706
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -3,
        "y": 1616,
        "w": 1578,
        "h": 1340,
        "radius": 5.672,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 55.686,
        "y": 38.611,
        "w": 1467.337,
        "h": 1395.578,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 537,
        "y": 51,
        "w": 460.055,
        "h": 460.055,
        "circle": true,
        "labelSize": 30,
        "label": "Fabric close-up"
      },
      "comment": "Same construction as training/_base — the real card is a transparent frame whose own FILL is the dark veil — but the women's box is started at 1616 instead of its measured 1595 so the renderer does not paint over the hero; see meta.knownDeviations. The 'Dark overlay' layer carries y -21 to compensate, so its gradient covers exactly the original 1578 x 1361 box.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 53.628,
          "y": 37.675,
          "w": 1473.961,
          "h": 1397.341,
          "opacity": 0.35,
          "comment": "Switched off in both women's designs (Rectangle 42167) — kept hidden so the option is visible to the designer.",
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Dark overlay",
          "x": 0,
          "y": -21,
          "w": 1578,
          "h": 1361,
          "radius": 5.672,
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.457,
                  0.344,
                  0.122
                ],
                [
                  -0.344,
                  0.33,
                  0.53
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ],
                [
                  0.535,
                  [
                    21,
                    0,
                    0
                  ],
                  0.6
                ],
                [
                  1,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2152.009,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1193,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.671,
          "comment": "In the Training files this is a VECTOR line with a gradient STROKE (`Vector 87` / `Vector 88`), not a filled rectangle. Reproduced as a 1.671px rectangle carrying the identical gradient as a fill — same pixels.",
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.4723,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 58,
          "cross": "CENTER",
          "max": 4,
          "comment": "24 is measured off the Trackpants' `Frame 861`, the only icon row in the three that is a real auto-layout hug (1077.26 = 304 + 243 + 304.26 + 154 + 3 x 24)."
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "comment": "Cards 1-3 are the All Over Print frame's (1097:1752). Card 4 is the Solid frame's, because the All Over Print design has only three — it is the only measurement of a fourth women's Training callout that exists. h3 carries the All Over Print frame's 21.852px trailing pad (see frame.bottomPad); h4 is the Solid frame's callout frame exactly. Unlike training/_base, these reproduce BOTH real page sizes: 4743 on three cards and 5327 on four.",
      "frame": {
        "name": "Callouts",
        "x": 70.305,
        "y": 3027,
        "w": 1431.634,
        "h4": 2300,
        "h3": 1716
      },
      "barHeight": 385.442,
      "bar": {
        "name": "Bar",
        "comment": "The real bar is a single white gradient at paint opacity 0.58 on a rotated matrix. The renderer builds callout bars with the fixed LR/RL directions only, so the same ramp is expressed as three stops at 0.58 — the running/_base approximation, unchanged.",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.119,
            "y": 71.312,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 68.303,
            "y": 7.542,
            "d": 517.239
          },
          "text": {
            "left": 729.695,
            "w": 663,
            "copyW": 634,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.493,
            "y": 612.674,
            "w": 1176.464,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545,
            "d": 517.239
          },
          "text": {
            "right": 693.695,
            "w": 626,
            "copyW": 626,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.553,
            "y": 1200.646,
            "w": 1052.679,
            "flip": false
          },
          "photo": {
            "x": 68.301,
            "y": 1133,
            "d": 517.239
          },
          "text": {
            "left": 730.695,
            "w": 598,
            "copyW": 598,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 125.798,
            "y": 1746,
            "w": 1176.464,
            "flip": true
          },
          "photo": {
            "x": 862,
            "y": 1680,
            "d": 517.239
          },
          "text": {
            "right": 697,
            "w": 622,
            "copyW": 612,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "NOT measured from any Training design — none of the three men's Training A+ files has a fit-comparison card. The geometry is carried over verbatim from running/_base (measured off the Running 706327) so that the plugin's manual 'add fit comparison to this frame' escape hatch still works on a Training frame. It stays off; re-measure it the day a Training design actually uses one.",
      "enabled": false,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2956
      },
      {
        "name": "2",
        "y": 2956,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. Columns are taken verbatim from the registry's sheet schema (backend/templates/index.json -> sheet), which is the single place the layout is defined: B=style IDs, C=category, G=headline ('TRAIN FEARLESS' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender. Training rows already exist in that sheet.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "TRAIN",
        "FEARLESS",
        "For the bold and the relentless"
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "comment": "titleTallPx is 160 rather than Running's 125 because the Training callout title line height is 75.71px (126.176% of 60), so two lines are already 151px.",
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "training/women/template-2": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "training",
      "categoryLabel": "Training",
      "version": 1,
      "status": "active",
      "updated": "2026-11-27",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The solid-colour women's Training A+, measured layer for layer off 1097:1861 on Page 2 (styles 707835, 707837, 707838) — the 4-callout, 1572 x 5327 version. It is not a structural variant of All Over Print: hero, Fabric in Focus and the callouts are the same construction, and the 4743 / 5327 difference is just 3 vs 4 callouts. What genuinely differs, and is restated here, is the art direction (crimson accent instead of teal, and a harder middle stop on the fabric veil), the hero backing-plate and model boxes, a larger fabric close-up, a lower and wider fabric text block, a wider icon row, and the four callout cards' own geometry. background.layers and hero.layers are restated in full because `extends` replaces arrays rather than merging them.",
      "width": 1572,
      "sliceSplitY": 2956,
      "artDirection": {
        "comment": "This template ships the Solid design's crimson on the two accent layers ('Wash · lower' and 'Hero shade · right'). See training/_women for the All Over Print teal and for the rule.",
        "accentLayers": [
          "Wash · lower",
          "Hero shade · right"
        ],
        "measured": {
          "707041/707042/707044 · Compression Top Solid 2": {
            "wash": [
              170,
              72,
              89
            ],
            "heroShade": [
              170,
              82,
              96
            ]
          },
          "707564/707565/707566 · Trackpants Graphic": {
            "wash": [
              72,
              103,
              88
            ],
            "heroShade": [
              82,
              111,
              100
            ]
          },
          "707175/707176/707177 · Shorts Graphic 1": {
            "wash": [
              114,
              63,
              137
            ],
            "heroShade": [
              109,
              54,
              122
            ]
          },
          "707841/707842 · Shorts All Over Print (women)": {
            "wash": [
              94,
              161,
              146
            ],
            "heroShade": [
              71,
              153,
              130
            ]
          },
          "707835/707837/707838 · Shorts Solid (women)": {
            "wash": [
              154,
              28,
              54
            ],
            "heroShade": [
              143,
              24,
              50
            ]
          }
        }
      },
      "notExpressible": [
        "The fabric card (`Frame 852`) carries a GLASS effect (radius 16.903) in both women's designs. The renderer gives the fabric box a solid fill and no effects, so the effect is dropped; the card's gradient veil itself IS reproduced, as the 'Dark overlay' layer.",
        "The hero italic word is x-centred by the renderer. Both originals place it at x 139.6, about 35px right of a centred 105, which the manifest cannot express because hero.italic has no x. Same deviation the men's designs have.",
        "The callout bar's real paint is one white gradient at opacity 0.58 on the matrix [[1.391,0.014,-0.414],[-0.144,1.391,-0.153]]. Resolving that matrix gives solid 58% out to 29.8% of the width then a fade to ~1% — which is what training/_base's three-stop LR approximation already draws, so it is inherited unchanged. Only the matrix's slight shear is lost.",
        "The fabric close-up ring EXISTS in both women's designs (Ellipse 801, white stroke 1.937px at 47% opacity) but is SWITCHED OFF in both. The renderer's `ring` role has no hidden state — it draws the ring unconditionally — so `fabric.ring` is deliberately omitted rather than shipped visible. This is the one place the women's Running split does not carry over: Running women's rings are on, Training women's are off.",
        "The `Fabric in Focus` heading carries a disabled DROP_SHADOW in both designs; the renderer's textStack has no effects field, so it is not reproduced (it is switched off anyway)."
      ],
      "knownDeviations": [
        "fabric.box starts at y 1616 with height 1340, not at the original Frame 852's y 1595 / height 1361. The renderer draws the hero BEFORE the fabric card, so a box starting at 1595 would paint over the hero's bottom 21px — in the originals the hero is on top. Those 21px are hidden behind the hero either way, and the 'Dark overlay' layer is offset by -21 so its gradient covers exactly the original 1578 x 1361 box. Bottom lands on 2956, the export slice boundary. This is a different convention from training/_base, which keeps the men's box at its measured y.",
        "'Wash · lower' is bottom-anchored, but the two women's frames disagree about the anchor: All Over Print sits 144.758px BELOW its bottom edge and Solid 145.242px ABOVE it. There is no reconciling value, so each template carries its own. Its gradient matrix is also the 3-callout lineage's ([[-0.701,-0.083,1.107],[1.211,-14.502,7.637]]), not the Running/Trackpants matrix training/_base inherits.",
        "callouts.title.lh is 60, not the base's 75.71. The women's callout titles measure 60px on a single line and 53-54px on two; 60 is the single-line measurement and matches the Running templates. warnings.titleTallPx goes back to 125 to suit it.",
        "Hidden leftovers NOT reproduced, matching the base's choice: a hidden duplicate of 'Glow · right lower' (Ellipse 87), a hidden wash entirely below the frame (Rectangle 42140, y 5685), a hidden fabric photo belonging to an unrelated style (705963_C), and a second, duplicated close-up mask group in the fabric card. The hidden layers that ARE reproduced are the alternate BG gradient, the alternate hero shade and the fabric Photo wash."
      ],
      "gender": "women",
      "genderLabel": "Women",
      "label": "Training · Women · Solid"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "comment": "ink and tag are read off the real Training text nodes (callout copy rgb(21,0,0), hero tagline rgb(113,119,124)). fabricBg is carried over from running/_base: the Training fabric card (Frame 852) has NO solid base fill at all, only the dark gradient that this manifest draws as the 'Dark overlay' layer, so a base colour had to be chosen — it is almost entirely covered by the fabric photo and the overlay.",
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "comment": "Both women's frames end flush: 3027 + 1694.148 callouts + 21.852 = 4743, and 3027 + 2300 + 0 = 5327. The dialect has one bottomPad, so it is 0 and the All Over Print frame's 21.852px trailing pad is folded into callouts.frame.h3 (1716). The callouts frame is unfilled and unclipped, so its height only ever sizes the page.",
      "fillRole": "white",
      "clip": true,
      "bottomPad": 0
    },
    "background": {
      "comment": "Frame-level art of 1097:1740, bottom to top. Same stack as training/_base — only 'Wash · lower' differs, in both placement and gradient matrix. Restated in full because `extends` replaces arrays rather than merging them.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -10,
          "y": 1616,
          "w": 1697,
          "hToFramePlus": 0,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.664,
                  -0.687
                ],
                [
                  -1.664,
                  0,
                  1.332
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.394,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.635,
          "y": 2121.094,
          "w": 1720.796,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "BG gradient · alternate",
          "x": -11.328,
          "y": 3008.414,
          "w": 1699.25,
          "h": 1784.865,
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  0,
                  0.894,
                  0
                ],
                [
                  -0.894,
                  0,
                  0.947
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ],
                [
                  0.433,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.195,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.086,
          "y": 3171.141,
          "w": 1370.967,
          "h": 969.542,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.222,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.934,
          "y": 3799.367,
          "w": 1720.796,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1124.389
            ],
            [
              0.417,
              -0.909,
              5181.758
            ]
          ],
          "yFromBottom": 145.242,
          "w": 1083.756,
          "h": 2786.279,
          "comment": "Crimson here, teal on the All Over Print design — the accent follows the garment. Bottom-anchored: the original's ty is 5181.758 on a 5327-tall frame, i.e. 145.242px above the bottom edge. The two women's frames do not agree on this anchor (All Over Print sits 144.758px BELOW its bottom edge), so each template carries its own.",
          "fills": [
            {
              "gt": [
                [
                  -0.701,
                  -0.083,
                  1.107
                ],
                [
                  1.211,
                  -14.502,
                  7.637
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    154,
                    28,
                    54
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.271
            ],
            [
              -0.417,
              0.909,
              2152.148
            ]
          ],
          "w": 1083.756,
          "h": 2786.279,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.203,
                  0.36,
                  0.934
                ],
                [
                  0.495,
                  -25.564,
                  13.235
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.921,
              -0.337,
              194.08
            ],
            [
              -0.389,
              -0.941,
              3512.977
            ]
          ],
          "w": 2325.05,
          "h": 1942.022,
          "fills": [
            {
              "gt": [
                [
                  -0.555,
                  -0.404,
                  1.294
                ],
                [
                  3.469,
                  -11.673,
                  1.417
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": "white",
      "comment": "Same stack as All Over Print, layer for layer; only the right-hand shade's colour and the two photo boxes differ.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "image 394 · texture",
          "x": -1085.187,
          "y": -66.687,
          "w": 2961.445,
          "h": 1681.681,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "rotation": 0,
              "imageTransform": [
                [
                  1,
                  0,
                  0
                ],
                [
                  0,
                  1,
                  0
                ]
              ],
              "filters": {
                "exposure": -1,
                "contrast": 0,
                "saturation": 0,
                "temperature": 0,
                "tint": 0,
                "highlights": 0,
                "shadows": 0
              }
            }
          ]
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.847,
          "h": 2361.402,
          "fills": [
            {
              "gt": [
                [
                  -1.736,
                  -0.212,
                  1.799
                ],
                [
                  0.254,
                  -2.837,
                  1.361
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    237,
                    234,
                    233
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.047
            ],
            [
              0.314,
              0.95,
              -237.719
            ]
          ],
          "w": 1205.983,
          "h": 1971.466,
          "fills": [
            {
              "gt": [
                [
                  -0.642,
                  -0.502,
                  1.419
                ],
                [
                  3.38,
                  -13.122,
                  6.632
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    143,
                    24,
                    50
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · alternate",
          "rt": [
            [
              -0.95,
              0.314,
              1543.709
            ],
            [
              -0.314,
              -0.95,
              1757.406
            ]
          ],
          "w": 2104.408,
          "h": 1653.617,
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  -1.677,
                  -0.582,
                  2.07
                ],
                [
                  -1.853,
                  -31.101,
                  25.455
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    139,
                    139,
                    139
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.756,
          "y": -530.758,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.134,
                  1.126,
                  -0.193
                ],
                [
                  -1.126,
                  0.067,
                  0.996
                ]
              ],
              "stops": [
                [
                  0.222,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background photo (full bleed)",
        "x": -142,
        "y": -178,
        "w": 1859,
        "h": 2026,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 536.553,
        "lhPct": 87,
        "ls": -32.19,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 13.52,
        "comment": "ls is the original's -6% of 536.553px. At this size 'TRAIN' measures 1464 wide, exactly as in the originals; longer words are scaled down to maxWidth by the renderer.",
        "fills": [
          {
            "opacity": 0.67,
            "gt": [
              [
                0.0795,
                0.8811,
                0.2121
              ],
              [
                -8.6741,
                0.0795,
                5.2407
              ]
            ],
            "stops": [
              [
                0,
                [
                  8,
                  8,
                  8
                ],
                1
              ],
              [
                1,
                [
                  75,
                  92,
                  124
                ],
                1
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 321.613,
        "lhPct": 87,
        "ls": -6.43,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 412.46,
        "blur": 16.903
      },
      "model": {
        "comment": "Measured off 705540_D bg 1. The women's heroes carry a single model photograph, not the men's stack.",
        "name": "Hero model photo · women's training",
        "x": 251,
        "y": 120,
        "w": 1074,
        "h": 1431,
        "fillOpacity": 0.35,
        "label": "Hero model photo · women's training"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 371,
        "x": 1140,
        "y": 706
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -3,
        "y": 1616,
        "w": 1578,
        "h": 1340,
        "radius": 5.672,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 55.727,
        "y": 38.617,
        "w": 1467.337,
        "h": 1395.578,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 531.001,
        "y": 58.999,
        "w": 503.634,
        "h": 503.634,
        "circle": true,
        "labelSize": 32,
        "label": "Fabric close-up"
      },
      "comment": "Same construction as training/_base — the real card is a transparent frame whose own FILL is the dark veil — but the women's box is started at 1616 instead of its measured 1595 so the renderer does not paint over the hero; see meta.knownDeviations. The 'Dark overlay' layer carries y -21 to compensate, so its gradient covers exactly the original 1578 x 1361 box.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 53.668,
          "y": 37.68,
          "w": 1473.961,
          "h": 1397.341,
          "opacity": 0.35,
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Dark overlay",
          "x": 0,
          "y": -21,
          "w": 1578,
          "h": 1361,
          "radius": 5.672,
          "comment": "Same veil as All Over Print except the middle stop, which here is opaque pure black rather than 60% of the ink colour — the Solid design's fabric band is noticeably darker through the middle.",
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.457,
                  0.344,
                  0.122
                ],
                [
                  -0.344,
                  0.33,
                  0.53
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ],
                [
                  0.535,
                  [
                    0,
                    0,
                    0
                  ],
                  1
                ],
                [
                  1,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2212,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1315,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.671,
          "comment": "In the Training files this is a VECTOR line with a gradient STROKE (`Vector 87` / `Vector 88`), not a filled rectangle. Reproduced as a 1.671px rectangle carrying the identical gradient as a fill — same pixels.",
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.4723,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 88,
          "cross": "CENTER",
          "max": 4,
          "comment": "24 is measured off the Trackpants' `Frame 861`, the only icon row in the three that is a real auto-layout hug (1077.26 = 304 + 243 + 304.26 + 154 + 3 x 24)."
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "comment": "All four cards measured off 1097:1873. Reproduces the real 1572 x 5327 page exactly.",
      "frame": {
        "name": "Callouts",
        "x": 70,
        "y": 3027,
        "w": 1432,
        "h4": 2300,
        "h3": 1716
      },
      "barHeight": 385.442,
      "bar": {
        "name": "Bar",
        "comment": "The real bar is a single white gradient at paint opacity 0.58 on a rotated matrix. The renderer builds callout bars with the fixed LR/RL directions only, so the same ramp is expressed as three stops at 0.58 — the running/_base approximation, unchanged.",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.119,
            "y": 71.313,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 68.303,
            "y": 7.539,
            "d": 517.239
          },
          "text": {
            "left": 732.695,
            "w": 685,
            "copyW": 685,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.493,
            "y": 612,
            "w": 1176.464,
            "flip": true
          },
          "photo": {
            "x": 841.695,
            "y": 546,
            "d": 517.239
          },
          "text": {
            "right": 697,
            "w": 665,
            "copyW": 665,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.553,
            "y": 1208,
            "w": 1052.679,
            "flip": false
          },
          "photo": {
            "x": 68.695,
            "y": 1142,
            "d": 517.239
          },
          "text": {
            "left": 733,
            "w": 661,
            "copyW": 661,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 125.798,
            "y": 1746,
            "w": 1176.464,
            "flip": true
          },
          "photo": {
            "x": 862,
            "y": 1680,
            "d": 517.239
          },
          "text": {
            "right": 697,
            "w": 622,
            "copyW": 612,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "NOT measured from any Training design — none of the three men's Training A+ files has a fit-comparison card. The geometry is carried over verbatim from running/_base (measured off the Running 706327) so that the plugin's manual 'add fit comparison to this frame' escape hatch still works on a Training frame. It stays off; re-measure it the day a Training design actually uses one.",
      "enabled": false,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2956
      },
      {
        "name": "2",
        "y": 2956,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. Columns are taken verbatim from the registry's sheet schema (backend/templates/index.json -> sheet), which is the single place the layout is defined: B=style IDs, C=category, G=headline ('TRAIN FEARLESS' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender. Training rows already exist in that sheet.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "TRAIN",
        "FEARLESS",
        "For the bold and the relentless"
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "comment": "titleTallPx is 160 rather than Running's 125 because the Training callout title line height is 75.71px (126.176% of 60), so two lines are already 151px.",
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  }
};
