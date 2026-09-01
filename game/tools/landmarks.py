"""Hand-authored landmarks for the 2 km x 2 km forest map.

Every entry carries its world position in map coordinates (0..2000 on X and Z),
an optional levelling pad, a Portuguese description for the design document and
a `build` callback that stamps the Kenney kit into place. Landmark order in
this list is the order used by the docs and the minimap legend.
"""

import math

import kit
from terrain import RIVERS, river_surface

# Deck clearance above a water surface for the river crossings.
BRIDGE_CLEARANCE = 7.0


def _river(rid):
    return next(r for r in RIVERS if r["id"] == rid)


def _bridge_over(b, rid, x, z, half_span, heading, storeys=1, sag=3.0):
    """Rope bridge across a river, with a leg tower planted on each bank."""
    surf = river_surface(_river(rid), x, z)
    rad = math.radians(heading)
    dx, dz = math.sin(rad) * half_span, math.cos(rad) * half_span
    ax, az = x - dx, z - dz
    bx, bz = x + dx, z + dz
    # The deck has to clear the water *and* every rise along the span, which on
    # a gorge crossing sits well above the stream.
    ridge = max(b.field.at(ax + (bx - ax) * i / 24.0, az + (bz - az) * i / 24.0)
                for i in range(25))
    deck = max(surf + BRIDGE_CLEARANCE, ridge + 2.5 + sag)
    b.rope_bridge(ax, az, bx, bz, deck_y=deck, sag=sag)
    leg = kit.unit("building-structure", "Y")
    for px, pz in ((ax, az), (bx, bz)):
        ground = b.field.at(px, pz)
        n = max(1, int(round((deck - ground) / leg)))
        for i in range(n):
            y = deck - (i + 1) * leg
            if y + leg <= ground - leg:
                break
            b.place("building-structure", px, pz, y=y, ry=heading)
        b.place("platform", px, pz, y=deck - kit.unit("platform", "Y"), ry=heading)
        b.place("ladder", px + math.cos(rad) * 3.4, pz - math.sin(rad) * 3.4,
                y=ground, ry=heading + 90)
    return deck


# --------------------------------------------------------------------------
# ZONE A - Vale das Tendas (NW)
# --------------------------------------------------------------------------
def _a_acampamento(b, lm, rng):
    b.camp_ring(lm["x"], lm["z"], tents=8, radius=34.0, rng=rng)
    b.fence_run([(lm["x"] - 62, lm["z"] - 52), (lm["x"] + 62, lm["z"] - 52)])
    for _ in range(14):
        a, r = rng.uniform(0, 6.283), rng.uniform(52, 96)
        b.place("tree", lm["x"] + math.cos(a) * r, lm["z"] + math.sin(a) * r,
                ry=rng.uniform(0, 360), scale=rng.uniform(0.85, 1.2))


def _a_torre_lago(b, lm, rng):
    b.tower(lm["x"], lm["z"], storeys=3, ry=210)
    b.rock_cluster(lm["x"] + 26, lm["z"] - 18, rng, count=5, spread=16)


def _a_pier(b, lm, rng):
    # Walk out from the shore into the lake so no deck tile lands in the bank.
    lake_level = 24.0
    deck_y = lake_level + 2.6 - kit.unit("platform", "Y")
    heading = math.radians(118)
    for i in range(8):
        px = lm["x"] - math.sin(heading) * i * kit.unit("platform", "Z")
        pz = lm["z"] - math.cos(heading) * i * kit.unit("platform", "Z")
        for side in (-0.5, 0.5):
            ox = px + math.cos(heading) * side * kit.unit("platform", "X")
            oz = pz - math.sin(heading) * side * kit.unit("platform", "X")
            b.place("platform", ox, oz, y=deck_y, ry=118)
            ground = b.field.at(ox, oz)
            n = max(1, int(round((deck_y - ground) / 6.0)))
            for k in range(n):
                y = deck_y - (k + 1) * 6.0
                if y + 6.0 <= ground:
                    break
                b.place("building-structure", ox, oz, y=y, ry=118)
    tip_x = lm["x"] - math.sin(heading) * 7 * kit.unit("platform", "Z")
    tip_z = lm["z"] - math.cos(heading) * 7 * kit.unit("platform", "Z")
    b.place("flag", tip_x, tip_z, y=deck_y + kit.unit("platform", "Y"), ry=40)


def _a_campo_novato(b, lm, rng):
    b.archery_lane(lm["x"], lm["z"], heading=270, targets=4, spacing=13.0, rng=rng)
    b.fence_run([(lm["x"] + 8, lm["z"] - 30), (lm["x"] + 8, lm["z"] + 30)])


def _a_circulo_pedras(b, lm, rng):
    for i in range(9):
        a = 2 * math.pi * i / 9
        b.place("rocks-high", lm["x"] + math.cos(a) * 26, lm["z"] + math.sin(a) * 26,
                ry=math.degrees(a), scale=rng.uniform(1.3, 1.9))
    b.place("patch-grass", lm["x"], lm["z"], scale=4.0)
    b.place("flag", lm["x"], lm["z"], scale=1.4)


def _a_posto_norte(b, lm, rng):
    ground = b.field.at(lm["x"], lm["z"])
    deck = ground + 12.0
    top = b.platform_deck(lm["x"], lm["z"], 3, 3, deck_y=deck, ry=25)
    b.place("ladder", lm["x"] + 9, lm["z"], y=ground, ry=25)
    b.place("ladder", lm["x"] + 9, lm["z"], y=ground + 6, ry=25)
    b.tower(lm["x"] - 22, lm["z"] + 14, storeys=2, ry=25, roof=True)
    b.place("tent", lm["x"] + 16, lm["z"] + 18, ry=200)
    b.place("flag", lm["x"] - 6, lm["z"] - 6, y=top, ry=25)


def _a_ponte_escarpa(b, lm, rng):
    _bridge_over(b, "corrego-escarpa", lm["x"], lm["z"], half_span=64.0, heading=0.0, sag=5.0)


# --------------------------------------------------------------------------
# ZONE B - Planalto das Torres (NE)
# --------------------------------------------------------------------------
def _b_grande_torre(b, lm, rng):
    top = b.tower(lm["x"], lm["z"], storeys=4, ry=45)
    b.tower(lm["x"] - 30, lm["z"] - 24, storeys=2, ry=45, roof=False)
    b.rope_bridge(lm["x"] - 6, lm["z"] - 6, lm["x"] - 26, lm["z"] - 20,
                  deck_y=top - kit.unit("building-roof", "Y") - 12.0, sag=1.5)
    b.rock_cluster(lm["x"] + 34, lm["z"] + 12, rng, count=7, spread=24)


def _b_fortaleza(b, lm, rng):
    ground = b.field.at(lm["x"], lm["z"])
    deck = ground + 18.0
    b.platform_deck(lm["x"], lm["z"], 4, 4, deck_y=deck, ry=0)
    b.platform_deck(lm["x"] + 70, lm["z"] + 26, 3, 3, deck_y=deck + 6.0, ry=0)
    b.rope_bridge(lm["x"] + 14, lm["z"] + 6, lm["x"] + 60, lm["z"] + 22,
                  deck_y=deck + 3.0, sag=2.5)
    b.tower(lm["x"] - 34, lm["z"] + 30, storeys=3, ry=300)
    for i in range(4):
        b.place("ladder", lm["x"] - 12, lm["z"] - 13, y=ground + i * 6.0)
    b.place("tent", lm["x"] + 4, lm["z"] - 2, y=deck + kit.unit("platform", "Y"), scale=0.8)


def _b_penhasco_falcao(b, lm, rng):
    b.rock_cluster(lm["x"], lm["z"], rng, count=16, spread=64, scale=1.4)
    b.tower(lm["x"] - 12, lm["z"] - 34, storeys=2, ry=160, roof=False)
    for _ in range(9):
        a, r = rng.uniform(0, 6.283), rng.uniform(40, 92)
        b.place("tree-high", lm["x"] + math.cos(a) * r, lm["z"] + math.sin(a) * r,
                ry=rng.uniform(0, 360), scale=rng.uniform(0.7, 1.0))


def _b_cascata(b, lm, rng):
    b.rock_cluster(lm["x"], lm["z"], rng, count=12, spread=46, scale=1.3)
    b.stair_ramp(lm["x"] + 30, lm["z"] - 26, ry=20, steps=6, rise=4.5)
    b.place("flag", lm["x"] + 40, lm["z"] - 10, scale=1.1)


def _b_acampamento_planalto(b, lm, rng):
    b.camp_ring(lm["x"], lm["z"], tents=6, radius=28.0, rng=rng)
    b.tower(lm["x"] + 44, lm["z"] - 20, storeys=2, ry=120)
    b.fence_run([(lm["x"] - 52, lm["z"] + 40), (lm["x"] + 40, lm["z"] + 44)])


def _b_escadaria(b, lm, rng):
    b.stair_ramp(lm["x"], lm["z"], ry=35, steps=9, rise=5.2)
    for i in range(5):
        b.place("ladder", lm["x"] - 14, lm["z"] + 6, y=b.field.at(lm["x"] - 14, lm["z"] + 6) + i * 6.0, ry=35)
    b.rock_cluster(lm["x"] + 22, lm["z"] - 16, rng, count=6, spread=20)


def _b_ponte_vau(b, lm, rng):
    _bridge_over(b, "rio-prateado", lm["x"], lm["z"], half_span=40.0, heading=90.0, sag=4.5)


# --------------------------------------------------------------------------
# ZONE C - Mata Antiga (SW)
# --------------------------------------------------------------------------
def _c_bosque_denso(b, lm, rng):
    for _ in range(42):
        a, r = rng.uniform(0, 6.283), rng.uniform(0, 120) ** 0.7 * 11
        b.place("tree-high", lm["x"] + math.cos(a) * r, lm["z"] + math.sin(a) * r,
                ry=rng.uniform(0, 360), scale=rng.uniform(0.9, 1.35))
    b.place("patch-grass", lm["x"], lm["z"], scale=3.0)


def _c_ruinas(b, lm, rng):
    for i in range(6):
        a = 2 * math.pi * i / 6
        px, pz = lm["x"] + math.cos(a) * 30, lm["z"] + math.sin(a) * 30
        b.place("building-structure", px, pz, ry=math.degrees(a), scale=rng.uniform(0.8, 1.1))
        if i % 2 == 0:
            b.place("platform", px, pz, y=b.field.at(px, pz) + 6.0, ry=math.degrees(a))
    b.place("patch-dirt", lm["x"], lm["z"], scale=4.5)
    b.rock_cluster(lm["x"], lm["z"], rng, count=8, spread=34)


def _c_ravina(b, lm, rng):
    b.rope_bridge(lm["x"] - 46, lm["z"] + 30, lm["x"] + 46, lm["z"] - 30,
                  deck_y=b.field.at(lm["x"], lm["z"]) + 26.0, sag=6.0)
    for px, pz in ((lm["x"] - 46, lm["z"] + 30), (lm["x"] + 46, lm["z"] - 30)):
        ground = b.field.at(px, pz)
        deck = b.field.at(lm["x"], lm["z"]) + 26.0
        n = max(1, int(round((deck - ground) / 6.0)))
        for i in range(n):
            b.place("building-structure", px, pz, y=deck - (i + 1) * 6.0)
    b.rock_cluster(lm["x"], lm["z"] - 60, rng, count=9, spread=30, scale=1.2)


def _c_torre_cacadora(b, lm, rng):
    b.tower(lm["x"], lm["z"], storeys=3, ry=75)
    b.place("tent", lm["x"] + 18, lm["z"] + 12, ry=250)
    b.place("target", lm["x"] - 20, lm["z"] + 6, ry=75, scale=1.1)
    b.place("character-archer", lm["x"] + 8, lm["z"] - 9, ry=250)


def _c_trilha_lanternas(b, lm, rng):
    path = [(430, 970), (500, 860), (560, 740), (660, 640), (760, 540), (880, 470), (1000, 430)]
    b.fence_run(path, gap=9.0)
    for i, (px, pz) in enumerate(path):
        b.place("patch-dirt", px, pz, scale=2.2)
        if i % 2 == 0:
            b.place("flag", px + 6, pz + 4, scale=0.9)


def _c_clareira_alvos(b, lm, rng):
    b.archery_lane(lm["x"], lm["z"], heading=90, targets=5, spacing=12.0, rng=rng)
    b.place("patch-grass", lm["x"], lm["z"], scale=5.0)
    for _ in range(10):
        a, r = rng.uniform(0, 6.283), rng.uniform(48, 88)
        b.place("tree-high", lm["x"] + math.cos(a) * r, lm["z"] + math.sin(a) * r,
                ry=rng.uniform(0, 360), scale=rng.uniform(1.0, 1.3))


def _c_pedras_roxas(b, lm, rng):
    b.rock_cluster(lm["x"], lm["z"], rng, count=18, spread=58, scale=1.5)
    b.stair_ramp(lm["x"] - 30, lm["z"] - 20, ry=70, steps=5, rise=4.0)


# --------------------------------------------------------------------------
# ZONE D - Campos de Treino (SE)
# --------------------------------------------------------------------------
def _d_arena(b, lm, rng):
    b.archery_lane(lm["x"], lm["z"], heading=0, targets=8, spacing=15.0, rng=rng)
    b.fence_run([(lm["x"] - 68, lm["z"] - 14), (lm["x"] + 68, lm["z"] - 14)])
    b.fence_run([(lm["x"] - 68, lm["z"] - 14), (lm["x"] - 68, lm["z"] + 58)])
    b.fence_run([(lm["x"] + 68, lm["z"] - 14), (lm["x"] + 68, lm["z"] + 58)])
    for sx in (-72, 72):
        b.place("flag", lm["x"] + sx, lm["z"] + 60, scale=1.3)


def _d_plataforma_comando(b, lm, rng):
    ground = b.field.at(lm["x"], lm["z"])
    deck = ground + 12.0
    top = b.platform_deck(lm["x"], lm["z"], 3, 2, deck_y=deck, ry=180)
    for i in range(2):
        b.place("ladder", lm["x"] + 2, lm["z"] + 7, y=ground + i * 6.0, ry=180)
    b.place("building-roof", lm["x"], lm["z"], y=top, ry=180, scale=1.4)
    b.place("flag", lm["x"] - 8, lm["z"] - 5, y=top, ry=180)
    b.place("character-archer", lm["x"] + 6, lm["z"] - 3, y=top, ry=0)


def _d_vila_tendas(b, lm, rng):
    b.camp_ring(lm["x"], lm["z"], tents=10, radius=42.0, rng=rng)
    b.camp_ring(lm["x"] + 96, lm["z"] + 34, tents=5, radius=24.0, rng=rng)
    b.fence_run([(lm["x"] - 70, lm["z"] - 60), (lm["x"] + 130, lm["z"] - 46)])
    b.tower(lm["x"] - 58, lm["z"] + 44, storeys=2, ry=140)


def _d_pedreira(b, lm, rng):
    b.rock_cluster(lm["x"], lm["z"], rng, count=26, spread=110, scale=1.6)
    b.stair_ramp(lm["x"] - 86, lm["z"] - 40, ry=48, steps=8, rise=4.6)
    b.place("patch-dirt", lm["x"], lm["z"], scale=8.0)
    b.tower(lm["x"] + 96, lm["z"] + 74, storeys=2, ry=225, roof=False)


def _d_campo_bandeiras(b, lm, rng):
    for i in range(12):
        a = 2 * math.pi * i / 12
        b.place("flag", lm["x"] + math.cos(a) * 46, lm["z"] + math.sin(a) * 46,
                ry=math.degrees(a), scale=rng.uniform(1.0, 1.3))
    b.place("patch-grass", lm["x"], lm["z"], scale=6.0)
    b.place("target", lm["x"], lm["z"] + 10, ry=180, scale=1.3)


def _d_ponte_baixa(b, lm, rng):
    _bridge_over(b, "rio-prateado", lm["x"], lm["z"], half_span=52.0, heading=90.0, sag=3.0)
    for i in range(6):
        b.place("stones", lm["x"] - 40 + i * 16, lm["z"] - 34, ry=i * 47, scale=1.1)


def _d_ponte_afluente(b, lm, rng):
    _bridge_over(b, "ribeira-falcao", lm["x"], lm["z"], half_span=58.0, heading=0.0, sag=4.0)


# --------------------------------------------------------------------------
# CENTRE - hub where all four zones meet
# --------------------------------------------------------------------------
def _h_confluencia(b, lm, rng):
    ground = b.field.at(lm["x"], lm["z"])
    deck = ground + 24.0
    top = b.platform_deck(lm["x"], lm["z"], 5, 5, deck_y=deck, ry=0)
    b.tower(lm["x"] - 42, lm["z"] + 40, storeys=4, ry=45)
    b.tower(lm["x"] + 44, lm["z"] + 38, storeys=3, ry=315)
    b.tower(lm["x"] - 40, lm["z"] - 44, storeys=3, ry=135)
    b.tower(lm["x"] + 42, lm["z"] - 42, storeys=3, ry=225)
    for ax, az in ((-42, 40), (44, 38), (-40, -44), (42, -42)):
        b.rope_bridge(lm["x"] + ax * 0.32, lm["z"] + az * 0.32,
                      lm["x"] + ax * 0.92, lm["z"] + az * 0.92, deck_y=deck + 1.5, sag=2.0)
    for i in range(4):
        b.place("ladder", lm["x"] + 15, lm["z"] + 2, y=ground + i * 6.0)
    b.place("building-roof", lm["x"], lm["z"], y=top, scale=2.0)
    b.place("flag", lm["x"] - 12, lm["z"] + 12, y=top, scale=1.6)
    b.place("flag", lm["x"] + 12, lm["z"] - 12, y=top, scale=1.6)


LANDMARKS = [
    # --- Zone A -----------------------------------------------------------
    dict(id="A1", name="Acampamento do Vale", zone="A", kind="camp", x=330, z=1420,
         pad=(80, 70), build=_a_acampamento,
         desc="Hub inicial do quadrante noroeste: oito tendas azuis em círculo ao redor de uma fogueira de pedras, sobre terra batida e cercas baixas."),
    dict(id="A2", name="Torre de Vigia do Lago", zone="A", kind="tower", x=250, z=1560,
         pad=(22, 30), build=_a_torre_lago,
         desc="Torre de madeira de 3 andares (18 m até o deque) com telhado azul e bandeira, encarando o Lago Espelho."),
    dict(id="A3", name="Lago Espelho", zone="A", kind="water", x=430, z=1700,
         pad=None, build=None,
         desc="Lago de margem recortada, 330 m de ponta a ponta, superfície a 24 m, com praia de areia e juncos em volta."),
    dict(id="A4", name="Píer de Madeira", zone="A", kind="platform", x=560, z=1640,
         pad=None, build=_a_pier,
         desc="Passarela de plataformas avançando 42 m sobre o lago, com bandeira na ponta."),
    dict(id="A5", name="Campo de Tiro do Novato", zone="A", kind="range", x=600, z=1300,
         pad=(60, 55), build=_a_campo_novato,
         desc="Linha de treino curta com 4 alvos a 46 m, cerca de segurança e três arqueiros."),
    dict(id="A6", name="Círculo de Pedras", zone="A", kind="ruin", x=720, z=1780,
         pad=(40, 45), build=_a_circulo_pedras,
         desc="Clareira ritual com nove monólitos roxos em círculo de 52 m e um estandarte central."),
    dict(id="A7", name="Posto Avançado Norte", zone="A", kind="platform", x=840, z=1870,
         pad=(45, 45), build=_a_posto_norte,
         desc="Deque elevado 12 m sobre estacas, com escadas, torre menor de apoio e tenda."),
    dict(id="A8", name="Ponte Suspensa da Escarpa", zone="A", kind="bridge", x=430, z=1000,
         pad=None, build=_a_ponte_escarpa,
         desc="Ponte de corda de 128 m sobre a garganta do Córrego da Escarpa; liga o Vale das Tendas (A) à Mata Antiga (C)."),

    # --- Zone B -----------------------------------------------------------
    dict(id="B1", name="Grande Torre de Vigia", zone="B", kind="tower", x=1520, z=1560,
         pad=(32, 40), build=_b_grande_torre,
         desc="Marco visual do mapa: torre de 4 andares (24 m) no ponto alto do planalto, ligada por ponte curta a uma torre auxiliar de 2 andares."),
    dict(id="B2", name="Fortaleza Suspensa", zone="B", kind="platform", x=1660, z=1720,
         pad=(90, 70), build=_b_fortaleza,
         desc="Rede de deques a 18 m e 24 m de altura unidos por ponte de corda, com torre de guarda e escadas de acesso."),
    dict(id="B3", name="Penhasco do Falcão", zone="B", kind="cliff", x=1850, z=1860,
         pad=None, build=_b_penhasco_falcao,
         desc="Mesa rochosa mais alta do mapa (141 m), paredões de rocha roxa, pinheiros altos na borda e um mirante sem telhado."),
    dict(id="B4", name="Cascata do Afluente", zone="B", kind="water", x=1400, z=1080,
         pad=None, build=_b_cascata,
         desc="Queda d'água onde a Ribeira do Falcão despenca do planalto para o vale central; rampas de pedra descem ao lado."),
    dict(id="B5", name="Acampamento do Planalto", zone="B", kind="camp", x=1280, z=1790,
         pad=(70, 60), build=_b_acampamento_planalto,
         desc="Seis tendas azuis abrigadas atrás de uma crista, com torre de 2 andares vigiando a aproximação oeste."),
    dict(id="B6", name="Escadaria da Rocha", zone="B", kind="path", x=1300, z=1400,
         pad=None, build=_b_escadaria,
         desc="Nove rampas de pedra mais escadas de madeira: a subida principal do vale central para o planalto."),
    dict(id="B7", name="Espelho do Falcão", zone="B", kind="water", x=1815, z=1795,
         pad=None, build=None,
         desc="Pequeno lago de altitude (124 m de diâmetro) encaixado na mesa, superfície a 118 m."),
    dict(id="B8", name="Ponte do Vau", zone="B", kind="bridge", x=1000, z=1520,
         pad=None, build=_b_ponte_vau,
         desc="Travessia norte do Rio Prateado, 80 m de vão com torres de apoio; liga o Vale das Tendas (A) ao Planalto das Torres (B)."),

    # --- Zone C -----------------------------------------------------------
    dict(id="C1", name="Bosque Denso", zone="C", kind="forest", x=300, z=620,
         pad=None, build=_c_bosque_denso,
         desc="Núcleo da mata fechada: pinheiros altos com copas sobrepostas e pouca visibilidade horizontal."),
    dict(id="C2", name="Ruínas da Clareira", zone="C", kind="ruin", x=520, z=720,
         pad=(46, 50), build=_c_ruinas,
         desc="Seis pilares de madeira em círculo, três ainda com deque, tomados por musgo e pedras."),
    dict(id="C3", name="Ravina do Musgo", zone="C", kind="bridge", x=700, z=470,
         pad=None, build=_c_ravina,
         desc="Fenda de 26 m de profundidade cruzada por ponte de corda diagonal de 110 m."),
    dict(id="C4", name="Torre Caçadora", zone="C", kind="tower", x=250, z=300,
         pad=(24, 30), build=_c_torre_cacadora,
         desc="Torre isolada de 3 andares no sul da mata, com tenda de apoio e alvo de treino."),
    dict(id="C5", name="Trilha das Lanternas", zone="C", kind="path", x=700, z=700,
         pad=None, build=_c_trilha_lanternas,
         desc="Trilha cercada de 780 m ligando a Ponte da Escarpa (A8) à Ponte Baixa (D5), marcada por estandartes."),
    dict(id="C6", name="Clareira dos Alvos Ocultos", zone="C", kind="range", x=640, z=180,
         pad=(60, 60), build=_c_clareira_alvos,
         desc="Clareira escondida com cinco alvos dispostos para tiro em movimento."),
    dict(id="C7", name="Pedras Roxas", zone="C", kind="cliff", x=150, z=850,
         pad=None, build=_c_pedras_roxas,
         desc="Afloramento de rocha roxa no flanco da Escarpa, com rampa escalável."),

    # --- Zone D -----------------------------------------------------------
    dict(id="D1", name="Arena de Arqueria", zone="D", kind="range", x=1520, z=360,
         pad=(110, 80), build=_d_arena,
         desc="Campo principal de tiro: oito alvos a 46 m, arena cercada de 136 × 72 m e bandeiras nos cantos."),
    dict(id="D2", name="Plataforma de Comando", zone="D", kind="platform", x=1450, z=540,
         pad=(40, 40), build=_d_plataforma_comando,
         desc="Deque coberto a 12 m sobre a arena, telhado azul, de onde o instrutor acompanha as raias."),
    dict(id="D3", name="Vila das Tendas Azuis", zone="D", kind="camp", x=1700, z=280,
         pad=(120, 90), build=_d_vila_tendas,
         desc="Maior assentamento do mapa: 15 tendas em dois círculos, cercado longo e torre de vigia a sudeste."),
    dict(id="D4", name="Pedreira Roxa", zone="D", kind="cliff", x=1840, z=640,
         pad=None, build=_d_pedreira,
         desc="Cratera de extração de 330 m com paredes de 34 m, blocos roxos espalhados e rampa de saída a noroeste."),
    dict(id="D5", name="Ponte Baixa das Pedras", zone="D", kind="bridge", x=1010, z=430,
         pad=None, build=_d_ponte_baixa,
         desc="Travessia sul do Rio Prateado com vau de pedras ao lado; liga a Mata Antiga (C) aos Campos de Treino (D)."),
    dict(id="D6", name="Ponte do Afluente", zone="D", kind="bridge", x=1560, z=1060,
         pad=None, build=_d_ponte_afluente,
         desc="Travessia da Ribeira do Falcão; liga os Campos de Treino (D) ao Planalto das Torres (B)."),
    dict(id="D7", name="Campo das Bandeiras", zone="D", kind="ruin", x=1250, z=250,
         pad=(60, 60), build=_d_campo_bandeiras,
         desc="Anel de doze estandartes em campo aberto, usado como ponto de reagrupamento e captura."),

    # --- Centre -----------------------------------------------------------
    dict(id="H1", name="Cruz da Confluência", zone="H", kind="hub", x=1000, z=1000,
         pad=(90, 90), build=_h_confluencia,
         desc="Coração do mapa, onde os três cursos d'água se encontram: deque central de 30 × 30 m a 24 m de altura, quatro torres nos cantos e quatro pontes de corda irradiando para as quatro zonas."),
]
