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
      "status": "coming-soon",
      "defaultGender": "men",
      "genders": [
        {
          "id": "men",
          "label": "Men",
          "status": "coming-soon",
          "hero": [
            "TRAIN",
            "FEARLESS"
          ],
          "templates": []
        },
        {
          "id": "women",
          "label": "Women",
          "status": "coming-soon",
          "hero": [
            "TRAIN",
            "FEARLESS"
          ],
          "templates": []
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
  }
};
