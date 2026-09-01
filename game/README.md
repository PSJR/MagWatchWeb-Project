# `game/` — Floresta de Vale Alto

Mapa 3D low-poly cartoon de **2 km × 2 km** no estilo do kit *Kenney Mini Forest 1.0*,
com gerador determinístico em Python e visualizador WebGL.

📖 **[Documento de design completo →](docs/MAP_DESIGN.md)** — visão geral, as 4 zonas,
os 31 marcos com coordenadas e a organização dos assets.

## Ver o mapa

O visualizador usa `fetch`, então precisa ser servido por HTTP (não abre por `file://`):

```bash
cd game
python3 -m http.server 8000
# abra http://localhost:8000/viewer/
```

Controles: `W A S D` mover · `Q`/`E` descer/subir · `Shift` correr · clique para travar
o mouse e olhar em volta. Os painéis controlam vento, hora do dia, distância de desenho
e o salto para qualquer marco. Três câmeras: **Voo**, **Órbita** e **Mapa** (topo).

O three.js (r170) está vendorizado em `viewer/vendor/`, então o visualizador funciona
offline.

## Regerar o mapa

```bash
python3 tools/gen_forest_map.py     # ~80 s
```

Só usa a biblioteca padrão do Python 3 — sem numpy, sem Pillow. Determinístico:
a semente é `20260901` e a mesma execução produz os mesmos bytes.

Isso reescreve:

| Saída | O que é |
|---|---|
| `assets/textures/heightmap_2k.png` | 1024², greyscale 16-bit, 0–165 m — para importar em engine |
| `assets/textures/heightmap_2k.u16.bin` | os mesmos dados em u16 little-endian, para leitura direta (o `<canvas>` do navegador reduz PNG 16-bit para 8 bits e cria degraus no terreno) |
| `assets/textures/splatmap_2k.png` | RGBA = pesos de grama / terra-margem / rocha / musgo |
| `assets/textures/minimap_2k.png` | preview sombreado, norte para cima |
| `data/forest_map_2k.json` | mundo, iluminação, vento, 4 zonas, 3 rios, 2 lagos, 31 marcos, 1.155 estruturas |
| `data/forest_map_2k.scatter.json` | 16.268 instâncias de vegetação/rocha em arrays compactos |

## Como o gerador está organizado

| Arquivo | Responsabilidade |
|---|---|
| `tools/noise.py` | Perlin, fBm e ruído *ridged* determinísticos |
| `tools/terrain.py` | campo de altura: mistura das 4 zonas, mesas terraceadas, escarpa, ravina, pedreira, escavação de rios e lagos; e o amostrador bilinear do heightmap já quantizado |
| `tools/kit.py` | escala do kit (1 unidade = 6 m) e as peças compostas — torre, deque sobre estacas, ponte de corda, acampamento, raia de tiro, rampa de pedra |
| `tools/landmarks.py` | os 31 marcos, escritos à mão, com posição, texto e a função que os monta |
| `tools/pngwrite.py` | encoder PNG (16-bit greyscale e RGBA 8-bit) sem dependências |
| `tools/gen_forest_map.py` | orquestra tudo e escreve as saídas |

### Duas passagens, de propósito

1. Os marcos registram **pads de nivelamento** e o heightmap é assado com eles —
   acampamentos e arenas ficam planos no próprio terreno, não sobre ele.
2. Só então as estruturas são carimbadas, amostrando o heightmap **já quantizado
   em 16 bits** — o mesmo dado que a engine carrega. Por isso nada flutua nem
   afunda: a verificação confirma 0 instâncias com geometria visível abaixo do
   terreno.

## Assets

`assets/models/` contém o kit **Kenney Mini Forest 1.0**, licença **CC0** — uso
pessoal, educacional e comercial livre, sem exigência de atribuição (mas
creditar *kenney.nl* é o certo a fazer). Ver `assets/LICENSE-kenney.txt`.

Cada pasta de modelos carrega sua própria cópia de `Textures/colormap.png` porque
é esse o caminho relativo embutido nos `.glb` — assim cada pasta pode ser
importada isoladamente numa engine.
