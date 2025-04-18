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
You may install geopandas and pyosmium if you intend to reprocess any
database or shapefile on the Raspi.
On a 64 bit quad-core Raspi, I suggest to install geopandas via pip while
on a 32 bit single-core Raspi python3-geopandas should be installed via apt.

As user with sudo privileges:
```
sudo apt install python3-fastapi python3-uvicorn python3-numpy iptables git #python3-pyosmium python3-geopandas
sudo useradd -m gpstracker
```
To switch over to the user gpstracker call
```
sudo su - gpstracker
```
or if you would like to be able to login as user gpstracker with your existing ssh keys being used for your Raspi user call
```
sudo -u gpstracker mkdir -p /home/gpstracker/.ssh
cat .ssh/authorized_keys | sudo -u gpstracker tee -a /home/gpstracker/.ssh/authorized_keys > /dev/null
sudo -u gpstracker chmod 600 /home/gpstracker/.ssh/authorized_keys
sudo -u gpstracker chmod 700 /home/gpstracker/.ssh
```
Continue as user gpstracker:
```
git clone https://github.com/jaluebbe/OfflineMap.git
cd OfflineMap/offline_map
python -m venv --system-site-packages venv
source venv/bin/activate
pip install pygeodesy point-in-geojson gdown #geopandas
```
#### Finally
Check your Python version by calling:
```
python --version
```
If your version is below 3.10 call:
```
pip install eval_type_backport
```
Download a pre-built mbtiles for Germany:
```
gdown 'https://drive.google.com/uc?id=15LSW2EPb7X6Cd8dMHQCdyqUVVSWgMot3' -O ../germany.mbtiles
```
or start with a smaller one for Bremen:
```
gdown 'https://drive.google.com/uc?id=1WghHOWt0vVxYFars2oUMU4gPWy46LDn0' -O ../bremen.mbtiles
```
### Install as a system service
As sudo user call (if you are still user gpstracker type ctrl+d or do an additional login in another window):
```
sudo cp /home/gpstracker/OfflineMap/etc/systemd/system/offline_map_api.service /etc/systemd/system/
sudo systemctl enable offline_map_api.service 
sudo systemctl start offline_map_api.service 
```

### Setup port forwarding
If you would avoid to add :8000 to the hostname of the device you can create
a port forwarding from port 80 to 8000.
At first try if it works by calling
```
sudo /usr/sbin/iptables -A PREROUTING -t nat -i wlan0 -p tcp --dport 80 -j REDIRECT --to-port 8000
```
and test if you could call the device without the port number.
Then call:
```
sudo apt install iptables-persistent
```
During installation, you will be prompted to save the current iptables rules. Select Yes.
If you change your rules after the installation of iptables-persistent just
call:
```
sudo netfilter-persistent save
```

### Setup hotspot
The hotspot setup for systems running bookwork mainly follows this
[Tutorial](https://www.raspberryconnect.com/projects/65-raspberrypi-hotspot-accesspoints/203-automated-switching-accesspoint-wifi-network).
Type the following commands and set name and password for your hotspot
network.
You may also add multiple known networks where the device should join as a
client.
```
curl "https://www.raspberryconnect.com/images/scripts/AccessPopup.tar.gz" -o AccessPopup.tar.gz
tar -xvf ./AccessPopup.tar.gz
cd AccessPopup
sudo ./installconfig.sh
```
### Prepare OpenStreetMap offline data (MBTiles) (optional)
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
