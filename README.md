# OfflineMap

## Setup
This repository contains as pre-filled database file with streets and places in Germany extracted from OpenStreetMap (OSM).
All the data is related to the German postal code (PLZ) regions as well as adminstrative boundaries (states, districts, communities).
This repository contains all scripts to refresh this data if required.
If this setup should be extended to another country, consider either to adapt the postal code and boundary system to your country or remove that dependency and rely completely on the data extracted from OSM. It may be also possible to extract the boundaries from OSM depending on how well they are maintained for your country.

It is mandatory to download an OSM file to create the MBTiles file.
You may start with a small region like Bremen to ensure everything is running.
Depending on your hardware for file preparation your may create a file not just for Germany but also the DACH region or even the whole of Europe.

### Setup of Python environment (mandatory)
```
cd offline_map
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
Check your Python version by calling:
```
python --version
```
If your version is below 3.10 call:
```
pip install eval_type_backport
```

### Prepare OpenStreetMap offline data (MBTiles) (mandatory)
```
docker run -e JAVA_TOOL_OPTIONS="-Xmx10g" -v "$(pwd)/data":/data openmaptiles/planetiler-openmaptiles:latest --download --force --area=europe
mv data/output.mbtiles data/europe.mbtiles
```
You need Docker. Do not try this on a Raspberry Pi. It may take more than a day to create the europe.mbtiles even on a powerful machine. You may choose another or a
smaller region (e.g. "germany" or "dach" to include Austria, Germany and Switzerland).
For more information see the
[Planetiler documentation](https://github.com/onthegomap/planetiler)
and the documentation of the [Planetiler OpenMapTiles
Profile](https://github.com/openmaptiles/planetiler-openmaptiles).
Finally, copy the renamed output.mbtiles to the following location on your Raspberry Pi:
```
/home/gpstracker/OfflineMap/
```

This process may fail on Apple's M4 CPU running Sequoia 15.3 .
A [workaround](https://github.com/corretto/corretto-21/issues/85) with the additional parameter "-XX:UseSVE=0" may help.

These are some calls that were running successful on a Mac Mini M4 with 16GB of RAM.
For the first test I started with the state of Lower Saxony:
```
docker run -e JAVA_TOOL_OPTIONS="-Xmx1g -XX:UseSVE=0" -v "$(pwd)/data":/data openmaptiles/planetiler-openmaptiles:latest --download --force --area=niedersachsen
mv data/output.mbtiles data/niedersachsen.mbtiles
```
It took 0:02:49 and resulted in a file size of 368 MB. 

Next I processed the data for Germany:
```
docker run -e JAVA_TOOL_OPTIONS="-Xmx2g -XX:UseSVE=0" -v "$(pwd)/data":/data openmaptiles/planetiler-openmaptiles:latest --download --force --area=germany
mv data/output.mbtiles data/germany.mbtiles
```
It took 0:56:52 and resulted in a file size of 2.9 GB.

Finally I was able to create a dataset for the DACH region (Germany, Austria, Switzerland):
```
docker run -e JAVA_TOOL_OPTIONS="-Xmx2g -XX:UseSVE=0" -v "$(pwd)/data":/data openmaptiles/planetiler-openmaptiles:latest --download --force --area=dach
mv data/output.mbtiles data/dach.mbtiles
```
It took 1:02:05 and resulted in a file size of 3.8 GB.

For larger OSM regions like Europe, the internal SSD (245.11 GB) is to small to handle amount of data.

### Prepare shapefiles and databases (optional)
OpenStreetMap provides a lot of great information.
However, there is no guarantee that all levels of administrative boundaries of the country are available.
I am using two different approaches to divide the map.
#### Administrative boundaries
The [BKG](https://www.bkg.bund.de) provides the dataset [VG5000](https://gdz.bkg.bund.de/index.php/default/open-data/verwaltungsgebiete-1-5-000-000-stand-01-01-vg5000-01-01.html) containing the administrative boundaries from country level over state and district down to community level.
The content of these shapefiles is integrated into communities_germany.json and germany.db .
If you would like to recreate these files, copy the VG5000 shapefiles of type LAN, KRS and GEM to a VG5000 folder in the main folder of this repository.
#### Postal code areas
Another well known method for country segmentation of are postal codes, called Postleitzahl (PLZ) in Germany.
The shapes of the postal codes are found in post_codes_germany.json .
To obtain the data for recreating the file you need to go to https://www.suche-postleitzahl.org/downloads and create a map "Karte erstellen".
Select "5-stellig", "GeoJSON", "mittel", "EPSG:4326 - wgs84" and download "plz-5stellig.geojson".
Additionally, download "zuordnung_plz_ort.csv" if you would like to update the database table "location_ags_plz".
Put these files into the main folder of this repository.
#### Data processing
Now call
```
prepare_shapefiles_and_database.py
```
to generate the GeoJSON shapes and database tables.
When input files are missing, the respective step will be skipped.
